import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';
import { prisma } from '@/lib/db/prisma';
import { encrypt, decrypt } from '@/lib/utils/encryption';
import { mapPlaidAccount, mapPlaidTransaction } from './plaid-transaction-mapper';
import { initializeCategories } from '@/lib/categories-init';
import type { AccountType, Prisma } from '@prisma/client';

// ─── Error sanitization ──────────────────────────────────────────────

/**
 * Reduce a Plaid/Axios error to fields that are safe to log.
 *
 * A raw AxiosError serializes its `config.data` (the request body), which for
 * Plaid contains `client_id`, the environment `secret`, and access/public
 * tokens. NEVER log the raw error object — always pass it through here first.
 */
export function sanitizePlaidError(error: unknown): Record<string, unknown> {
  const e = error as {
    message?: string;
    response?: {
      status?: number;
      data?: {
        error_type?: string;
        error_code?: string;
        error_message?: string;
        request_id?: string;
      };
    };
  };
  const data = e?.response?.data;
  if (data?.error_type || data?.error_code) {
    return {
      error_type: data.error_type,
      error_code: data.error_code,
      error_message: data.error_message,
      request_id: data.request_id,
      status: e.response?.status,
    };
  }
  return { message: e?.message ?? 'unknown error' };
}

// ─── Lazy client initialization ──────────────────────────────────────

let _client: PlaidApi | null = null;
let _currentMode: string | null = null;

/** Resolve the active Plaid mode and secret from PLAID_ENV toggle. */
function plaidMode() {
  const mode = process.env.PLAID_ENV || process.env.PLAID_MODE || 'sandbox';
  const secret =
    mode === 'production'
      ? process.env.PLAID_PROD_SECRET
      : process.env.PLAID_SANDBOX_SECRET;

  // PLAID_SECRET is the primary var; per-mode vars allow keeping both configured
  return {
    env: mode,
    secret: process.env.PLAID_SECRET || secret || '',
  };
}

/** True when Plaid credentials are configured (used for graceful degradation). */
export function isPlaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && plaidMode().secret);
}

export function getPlaidClient(): PlaidApi {
  const { env } = plaidMode();

  // Recreate client if mode changed (e.g., after .env toggle + restart)
  if (_client && _currentMode === env) return _client;

  if (!process.env.PLAID_CLIENT_ID) {
    throw new Error('PLAID_CLIENT_ID must be set');
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[env as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
  });

  _client = new PlaidApi(configuration);
  _currentMode = env;
  return _client;
}

/** Credentials object injected into every Plaid API request body. */
export function plaidCredentials() {
  const { secret } = plaidMode();
  return {
    client_id: process.env.PLAID_CLIENT_ID!,
    secret,
  };
}

// ─── Products config ─────────────────────────────────────────────────

const PRODUCT_MAP: Record<string, Products> = {
  transactions: Products.Transactions,
  auth: Products.Auth,
  identity: Products.Identity,
  liabilities: Products.Liabilities,
};

function parseProducts(envVar: string | undefined, fallback: string): Products[] {
  const str = envVar ?? fallback;
  return str
    .split(',')
    .map((p) => PRODUCT_MAP[p.trim()])
    .filter(Boolean);
}

const CLIENT_NAME = 'Credit Card Manager';

// ─── Link Token ──────────────────────────────────────────────────────

export async function createLinkToken(userId: string): Promise<string> {
  const client = getPlaidClient();

  // Required products — must be supported or the institution is hidden in Link
  const products = parseProducts(process.env.PLAID_PRODUCTS, 'transactions');

  // Optional products — best-effort, silently skipped if unsupported or consent denied
  const optionalProducts = parseProducts(process.env.PLAID_OPTIONAL_PRODUCTS, '');

  const response = await client.linkTokenCreate({
    ...plaidCredentials(),
    user: { client_user_id: userId },
    client_name: CLIENT_NAME,
    products,
    ...(optionalProducts.length > 0 ? { optional_products: optionalProducts } : {}),
    country_codes: [CountryCode.Us],
    language: 'en',
    webhook: process.env.PLAID_WEBHOOK_URL || undefined,
    redirect_uri: process.env.PLAID_REDIRECT_URI || undefined,
    transactions: { days_requested: 730 },
  });

  console.log('[Plaid] linkTokenCreate request_id:', response.data.request_id);
  return response.data.link_token;
}

// ─── Update Mode Link Token ─────────────────────────────────────────

export async function createUpdateModeLinkToken(
  userId: string,
  accessToken: string
): Promise<string> {
  const client = getPlaidClient();

  const response = await client.linkTokenCreate({
    ...plaidCredentials(),
    user: { client_user_id: userId },
    client_name: CLIENT_NAME,
    access_token: accessToken,
    country_codes: [CountryCode.Us],
    language: 'en',
    webhook: process.env.PLAID_WEBHOOK_URL || undefined,
    redirect_uri: process.env.PLAID_REDIRECT_URI || undefined,
  });

  console.log('[Plaid] linkTokenCreate (update mode) request_id:', response.data.request_id);
  return response.data.link_token;
}

// ─── Token Exchange ──────────────────────────────────────────────────

export async function exchangePublicToken(
  userId: string,
  publicToken: string
): Promise<{ itemId: string; plaidItemId: string }> {
  const client = getPlaidClient();

  const exchangeResponse = await client.itemPublicTokenExchange({
    ...plaidCredentials(),
    public_token: publicToken,
  });

  const { access_token, item_id, request_id } = exchangeResponse.data;
  console.log('[Plaid] itemPublicTokenExchange request_id:', request_id);

  // Duplicate item detection: check if this Plaid item is already linked
  const existingItem = await prisma.plaidItem.findUnique({
    where: { itemId: item_id },
  });

  if (existingItem) {
    // Item already exists — revoke the newly exchanged token (it's a duplicate)
    try {
      await client.itemRemove({
        ...plaidCredentials(),
        access_token,
      });
    } catch {
      // Best-effort cleanup of the duplicate token
    }

    if (existingItem.userId === userId) {
      throw new Error('DUPLICATE_ITEM: This institution is already connected to your account.');
    } else {
      throw new Error('DUPLICATE_ITEM: This institution is already connected to another account.');
    }
  }

  // Get institution info
  const itemResponse = await client.itemGet({
    ...plaidCredentials(),
    access_token,
  });
  const institutionId = itemResponse.data.item.institution_id;
  console.log('[Plaid] itemGet request_id:', itemResponse.data.request_id);
  let institutionName: string | null = null;

  if (institutionId) {
    try {
      const instResponse = await client.institutionsGetById({
        ...plaidCredentials(),
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      });
      institutionName = instResponse.data.institution.name;
    } catch {
      // Non-critical — continue without institution name
    }
  }

  // Encrypt and store the access token
  const encryptedToken = encrypt(access_token);

  // Default consent expiry: 1 year from now (per Plaid's consent model)
  const consentExpiresAt = new Date();
  consentExpiresAt.setFullYear(consentExpiresAt.getFullYear() + 1);

  const plaidItem = await prisma.plaidItem.create({
    data: {
      userId,
      accessToken: encryptedToken,
      itemId: item_id,
      institutionId,
      institutionName,
      status: 'ACTIVE',
      consentExpiresAt,
    },
  });

  // Audit log: successful token exchange
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'PLAID_TOKEN_EXCHANGED',
      resource: `PlaidItem:${plaidItem.id}`,
      details: JSON.stringify({
        plaidItemId: item_id,
        institutionId,
        institutionName,
        requestId: request_id,
      }),
      success: true,
    },
  });

  return { itemId: plaidItem.id, plaidItemId: item_id };
}

// ─── Sync Accounts ──────────────────────────────────────────────────

export async function syncAccounts(plaidItemId: string): Promise<{
  accountsUpdated: number;
}> {
  const plaidItem = await prisma.plaidItem.findUnique({
    where: { id: plaidItemId },
  });

  if (!plaidItem) {
    throw new Error('PlaidItem not found');
  }

  const client = getPlaidClient();
  const accessToken = decrypt(plaidItem.accessToken);

  const response = await client.accountsGet({
    ...plaidCredentials(),
    access_token: accessToken,
  });

  const { accounts } = response.data;
  let accountsUpdated = 0;

  for (const plaidAccount of accounts) {
    const mapped = mapPlaidAccount(plaidAccount, plaidItem.institutionName);

    // Find existing account by userId + accountNumber
    const existing = await prisma.userAccount.findFirst({
      where: {
        userId: plaidItem.userId,
        accountNumber: mapped.accountNumber,
      },
    });

    if (existing) {
      await prisma.userAccount.update({
        where: { id: existing.id },
        data: {
          name: mapped.name,
          type: mapped.type as AccountType,
          balance: mapped.balance,
          institution: plaidItem.institutionName || 'Connected Account',
        },
      });
    } else {
      await prisma.userAccount.create({
        data: {
          userId: plaidItem.userId,
          name: mapped.name,
          type: mapped.type as AccountType,
          balance: mapped.balance,
          institution: plaidItem.institutionName || 'Connected Account',
          accountNumber: mapped.accountNumber,
        },
      });
    }
    accountsUpdated++;
  }

  return { accountsUpdated };
}

// ─── Sync Transactions (Cursor-Based) ───────────────────────────────

// A sync lock older than this is treated as abandoned (crashed process) and reclaimed.
const SYNC_LOCK_STALE_MS = 10 * 60 * 1000;

export async function syncTransactions(plaidItemId: string): Promise<{
  added: number;
  modified: number;
  removed: number;
  skipped?: boolean;
}> {
  const plaidItem = await prisma.plaidItem.findUnique({
    where: { id: plaidItemId },
  });

  if (!plaidItem) {
    throw new Error('PlaidItem not found');
  }

  // Serialize syncs per item. The normal linking flow runs several sync paths
  // concurrently (inline exchange-token sync + INITIAL/HISTORICAL webhooks +
  // manual sync); without this they read the same cursor and double-process.
  // Compare-and-swap the lock, reclaiming it if a prior run died holding it.
  const staleCutoff = new Date(Date.now() - SYNC_LOCK_STALE_MS);
  const acquired = await prisma.plaidItem.updateMany({
    where: {
      id: plaidItemId,
      OR: [{ syncInProgress: false }, { syncStartedAt: { lt: staleCutoff } }],
    },
    data: { syncInProgress: true, syncStartedAt: new Date() },
  });
  if (acquired.count === 0) {
    // Another sync holds the lock — skip rather than duplicate work.
    return { added: 0, modified: 0, removed: 0, skipped: true };
  }

  try {
    return await runTransactionSync(plaidItem);
  } finally {
    await prisma.plaidItem
      .update({
        where: { id: plaidItemId },
        data: { syncInProgress: false, syncStartedAt: null },
      })
      .catch(() => {
        // Best-effort release; a stale lock will be reclaimed after the timeout.
      });
  }
}

async function runTransactionSync(
  plaidItem: NonNullable<Awaited<ReturnType<typeof prisma.plaidItem.findUnique>>>
): Promise<{ added: number; modified: number; removed: number }> {
  const plaidItemId = plaidItem.id;

  // Ensure categories exist before first sync
  const catCount = await prisma.category.count();
  if (catCount === 0) {
    await initializeCategories();
  }

  const client = getPlaidClient();
  const accessToken = decrypt(plaidItem.accessToken);
  const batchId = `plaid_sync_${plaidItemId}_${Date.now()}`;

  // Build account lookup: Plaid account_id → our UserAccount.id
  const userAccounts = await prisma.userAccount.findMany({
    where: { userId: plaidItem.userId },
    select: { id: true, accountNumber: true },
  });

  // We also need the Plaid accounts to map account_id → mask
  const plaidAccountsResponse = await client.accountsGet({
    ...plaidCredentials(),
    access_token: accessToken,
  });
  const plaidAccountIdToMask = new Map<string, string>();
  for (const acct of plaidAccountsResponse.data.accounts) {
    const mask = acct.mask ? `...${acct.mask}` : `...${acct.account_id.slice(-4)}`;
    plaidAccountIdToMask.set(acct.account_id, mask);
  }

  // Map mask → our UserAccount.id
  const maskToAccountId = new Map<string, string>();
  for (const ua of userAccounts) {
    if (ua.accountNumber) {
      maskToAccountId.set(ua.accountNumber, ua.id);
    }
  }

  let cursor = plaidItem.cursor || undefined;
  let totalAdded = 0;
  let totalModified = 0;
  let totalRemoved = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await client.transactionsSync({
      ...plaidCredentials(),
      access_token: accessToken,
      cursor,
    });

    const { added, modified, removed, next_cursor, has_more } = response.data;

    // Process added transactions
    for (const txn of added) {
      const mask = plaidAccountIdToMask.get(txn.account_id);
      const accountId = mask ? maskToAccountId.get(mask) : undefined;
      if (!accountId) {
        continue;
      }

      const mapped = mapPlaidTransaction(txn);
      const locationJson = (mapped.location ?? undefined) as Prisma.InputJsonValue | undefined;
      const originalDataJson = mapped.originalData as unknown as Prisma.InputJsonValue;

      // Upsert by importSource (plaid_<transaction_id>, unique) — idempotent
      // against retries and concurrent sync pages.
      await prisma.transaction.upsert({
        where: { importSource: mapped.importSource },
        update: {
          amount: mapped.amount,
          description: mapped.description,
          originalDescription: mapped.originalDescription,
          merchant: mapped.merchant,
          category: mapped.category,
          subcategory: mapped.subcategory,
          type: mapped.type,
          status: mapped.status,
          date: mapped.date,
          location: locationJson,
          originalData: originalDataJson,
        },
        create: {
          userId: plaidItem.userId,
          accountId,
          amount: mapped.amount,
          description: mapped.description,
          originalDescription: mapped.originalDescription,
          merchant: mapped.merchant,
          category: mapped.category,
          subcategory: mapped.subcategory,
          type: mapped.type,
          status: mapped.status,
          date: mapped.date,
          location: locationJson,
          importSource: mapped.importSource,
          importBatch: batchId,
          originalData: originalDataJson,
        },
      });
      totalAdded++;
    }

    // Process modified transactions
    for (const txn of modified) {
      const mapped = mapPlaidTransaction(txn);
      const locationJson = (mapped.location ?? undefined) as Prisma.InputJsonValue | undefined;
      const originalDataJson = mapped.originalData as unknown as Prisma.InputJsonValue;

      const existing = await prisma.transaction.findUnique({
        where: { importSource: mapped.importSource },
      });

      if (existing) {
        await prisma.transaction.update({
          where: { id: existing.id },
          data: {
            amount: mapped.amount,
            description: mapped.description,
            originalDescription: mapped.originalDescription,
            merchant: mapped.merchant,
            category: mapped.category,
            subcategory: mapped.subcategory,
            type: mapped.type,
            status: mapped.status,
            date: mapped.date,
            location: locationJson,
            originalData: originalDataJson,
          },
        });
        totalModified++;
      }
    }

    // Process removed transactions
    for (const txn of removed) {
      const importSource = `plaid_${txn.transaction_id}`;
      const existing = await prisma.transaction.findUnique({
        where: { importSource },
      });
      if (existing) {
        await prisma.transaction.delete({ where: { id: existing.id } });
        totalRemoved++;
      }
    }

    // Update cursor after each page
    cursor = next_cursor;
    await prisma.plaidItem.update({
      where: { id: plaidItemId },
      data: { cursor: next_cursor, lastSyncedAt: new Date() },
    });

    hasMore = has_more;
  }

  return { added: totalAdded, modified: totalModified, removed: totalRemoved };
}

// ─── Disconnect Item (keep data) ─────────────────────────────────────

export async function disconnectPlaidItem(
  plaidItemId: string,
  userId: string
): Promise<void> {
  const plaidItem = await prisma.plaidItem.findFirst({
    where: { id: plaidItemId, userId },
  });

  if (!plaidItem) {
    throw new Error('PlaidItem not found or access denied');
  }

  // Revoke access at Plaid
  try {
    const client = getPlaidClient();
    const accessToken = decrypt(plaidItem.accessToken);
    const removeResponse = await client.itemRemove({
      ...plaidCredentials(),
      access_token: accessToken,
    });
    console.log('[Plaid] itemRemove (disconnect) request_id:', removeResponse.data.request_id);
  } catch {
    // Continue even if Plaid call fails (token may already be invalid)
  }

  await prisma.plaidItem.update({
    where: { id: plaidItemId },
    data: { status: 'DISCONNECTED' },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'PLAID_ITEM_DISCONNECTED',
      resource: `PlaidItem:${plaidItemId}`,
      details: JSON.stringify({
        institutionName: plaidItem.institutionName,
      }),
      success: true,
    },
  });
}

// ─── Delete Item (revoke + purge all data) ───────────────────────────

export async function deletePlaidItem(
  plaidItemId: string,
  userId: string
): Promise<void> {
  const plaidItem = await prisma.plaidItem.findFirst({
    where: { id: plaidItemId, userId },
  });

  if (!plaidItem) {
    throw new Error('PlaidItem not found or access denied');
  }

  // Identify which local accounts came from this Plaid connection
  // by fetching account masks from Plaid before revoking access
  const accountMasks: string[] = [];
  const accessToken = decrypt(plaidItem.accessToken);

  try {
    const client = getPlaidClient();
    const response = await client.accountsGet({
      ...plaidCredentials(),
      access_token: accessToken,
    });

    for (const acct of response.data.accounts) {
      const mask = acct.mask ? `...${acct.mask}` : `...${acct.account_id.slice(-4)}`;
      accountMasks.push(mask);
    }
  } catch {
    // Plaid unreachable — fall back to institution-based cleanup below
  }

  // Revoke access at Plaid (independent of accountsGet success)
  try {
    const client = getPlaidClient();
    await client.itemRemove({
      ...plaidCredentials(),
      access_token: accessToken,
    });
  } catch {
    // Token may already be invalid or revoked — continue cleanup
  }

  // Delete local accounts (and their child records via cascade) that match
  if (accountMasks.length > 0) {
    await prisma.userAccount.deleteMany({
      where: {
        userId,
        accountNumber: { in: accountMasks },
      },
    });
  } else if (plaidItem.institutionName) {
    // Fallback: Plaid was unreachable so we couldn't get account masks.
    // Clean up local accounts by institution name, but only if this is
    // the user's only PlaidItem for this institution (avoid cross-contamination).
    const sameInstitutionCount = await prisma.plaidItem.count({
      where: {
        userId,
        institutionName: plaidItem.institutionName,
        id: { not: plaidItemId },
      },
    });

    if (sameInstitutionCount === 0) {
      await prisma.userAccount.deleteMany({
        where: { userId, institution: plaidItem.institutionName },
      });
    }
  }

  // Delete the PlaidItem row (encrypted access token and all metadata)
  await prisma.plaidItem.delete({
    where: { id: plaidItemId },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'PLAID_ITEM_DELETED',
      resource: `PlaidItem:${plaidItemId}`,
      details: JSON.stringify({
        institutionName: plaidItem.institutionName,
        accountsCleaned: accountMasks.length,
      }),
      success: true,
    },
  });
}

// ─── Remove All Plaid Items (for account deletion) ─────────────────

export async function removeAllPlaidItems(userId: string): Promise<void> {
  const plaidItems = await prisma.plaidItem.findMany({
    where: { userId },
  });

  const client = getPlaidClient();

  for (const item of plaidItems) {
    // Revoke access at Plaid (catch errors for already-revoked tokens)
    try {
      const accessToken = decrypt(item.accessToken);
      await client.itemRemove({
        ...plaidCredentials(),
        access_token: accessToken,
      });
    } catch {
      // Token may already be invalid or revoked — continue cleanup
    }
  }

  // Delete all PlaidItem rows for this user
  if (plaidItems.length > 0) {
    await prisma.plaidItem.deleteMany({
      where: { userId },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'PLAID_ALL_ITEMS_REMOVED',
        resource: `User:${userId}`,
        details: JSON.stringify({
          itemCount: plaidItems.length,
          institutions: plaidItems.map((i) => i.institutionName).filter(Boolean),
        }),
        success: true,
      },
    });
  }
}

// ─── Get User Items ──────────────────────────────────────────────────

export async function getUserPlaidItems(userId: string) {
  return prisma.plaidItem.findMany({
    where: { userId },
    select: {
      id: true,
      itemId: true,
      institutionId: true,
      institutionName: true,
      status: true,
      lastSyncedAt: true,
      errorCode: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Update Item Webhook URL ─────────────────────────────────────────

export async function updateItemWebhook(plaidItemId: string): Promise<boolean> {
  const webhookUrl = process.env.PLAID_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const plaidItem = await prisma.plaidItem.findUnique({
    where: { id: plaidItemId },
  });

  if (!plaidItem) return false;

  const client = getPlaidClient();
  const accessToken = decrypt(plaidItem.accessToken);

  await client.itemWebhookUpdate({
    ...plaidCredentials(),
    access_token: accessToken,
    webhook: webhookUrl,
  });

  return true;
}

// ─── Webhook Handler ─────────────────────────────────────────────────

export async function handlePlaidWebhook(
  webhookType: string,
  webhookCode: string,
  itemId: string
): Promise<{ action: string; result?: Record<string, unknown> }> {
  const plaidItem = await prisma.plaidItem.findUnique({
    where: { itemId },
  });

  if (!plaidItem) {
    console.warn(`Webhook for unknown item: ${itemId}`);
    return { action: 'ignored', result: { reason: 'unknown_item' } };
  }

  const key = `${webhookType}:${webhookCode}`;
  let action = 'processed';
  let result: Record<string, unknown> = {};

  switch (key) {
    // ── Transactions ──
    case 'TRANSACTIONS:SYNC_UPDATES_AVAILABLE':
    case 'TRANSACTIONS:INITIAL_UPDATE':
    case 'TRANSACTIONS:HISTORICAL_UPDATE':
    case 'TRANSACTIONS:TRANSACTIONS_REMOVED': {
      const syncResult = await syncTransactions(plaidItem.id);
      result = syncResult;
      action = 'sync_transactions';
      break;
    }

    // ── Item status: login repaired (after update mode) ──
    case 'ITEM:LOGIN_REPAIRED':
      await prisma.plaidItem.update({
        where: { id: plaidItem.id },
        data: { status: 'ACTIVE', errorCode: null },
      });
      action = 'status_update';
      result = { newStatus: 'ACTIVE', repairedFrom: 'LOGIN_REQUIRED' };
      break;

    // ── Item status: new accounts available ──
    case 'ITEM:NEW_ACCOUNTS_AVAILABLE': {
      const syncResult = await syncAccounts(plaidItem.id);
      action = 'sync_accounts';
      result = syncResult;
      break;
    }

    // ── Item status: login/expiration ──
    case 'ITEM:LOGIN_REQUIRED':
    case 'ITEM:PENDING_EXPIRATION':
      await prisma.plaidItem.update({
        where: { id: plaidItem.id },
        data: {
          status: webhookCode === 'LOGIN_REQUIRED' ? 'LOGIN_REQUIRED' : 'PENDING_EXPIRATION',
          errorCode: webhookCode,
        },
      });
      action = 'status_update';
      result = { newStatus: webhookCode };
      break;

    // ── Item status: disconnect/revoke ──
    case 'ITEM:PENDING_DISCONNECT':
      await prisma.plaidItem.update({
        where: { id: plaidItem.id },
        data: { status: 'PENDING_EXPIRATION', errorCode: webhookCode },
      });
      action = 'status_update';
      result = { newStatus: 'PENDING_EXPIRATION' };
      break;

    case 'ITEM:USER_PERMISSION_REVOKED':
    case 'ITEM:USER_ACCOUNT_REVOKED':
      await prisma.plaidItem.update({
        where: { id: plaidItem.id },
        data: { status: 'REVOKED', errorCode: webhookCode },
      });
      action = 'status_update';
      result = { newStatus: 'REVOKED' };
      break;

    // ── Item error ──
    case 'ITEM:ERROR':
      await prisma.plaidItem.update({
        where: { id: plaidItem.id },
        data: { errorCode: webhookCode },
      });
      action = 'error_recorded';
      result = { errorCode: webhookCode };
      break;

    // ── Webhook URL update confirmation ──
    case 'ITEM:WEBHOOK_UPDATE_ACKNOWLEDGED':
      action = 'webhook_update_confirmed';
      break;

    default:
      action = 'unhandled';
      console.log(`Unhandled Plaid webhook: ${key}`);
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: plaidItem.userId,
      action: 'PLAID_WEBHOOK',
      resource: `PlaidItem:${plaidItem.id}`,
      details: JSON.stringify({
        webhookType,
        webhookCode,
        itemId,
        institutionName: plaidItem.institutionName,
        handlerAction: action,
        result,
      }),
      success: action !== 'unhandled',
    },
  });

  return { action, result };
}
