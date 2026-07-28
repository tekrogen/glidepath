import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import {
  sanitizePlaidError,
  syncAccounts,
  syncTransactions,
  updateItemWebhook,
} from '@/lib/services/plaid-service';
import { prisma } from '@/lib/db/prisma';
import { syncLiabilitiesForItem } from '@/features/cards/server/liabilities-sync';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  // Refreshes data from a Plaid connection — requires plaid:manage (USER).
  const guard = await requirePermission('plaid:manage');
  if (!guard.success) return guard.response;

  const { itemId } = await params;

  // Verify the item belongs to the user
  const plaidItem = await prisma.plaidItem.findFirst({
    where: { id: itemId, userId: guard.session.user.id },
  });

  if (!plaidItem) {
    return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
  }

  try {
    // Ensure webhook URL is set on the item
    try {
      await updateItemWebhook(itemId);
    } catch {
      // Non-critical — continue with sync even if webhook update fails
    }

    // Sync accounts first (needed as FK for transactions)
    const accountResult = await syncAccounts(itemId);

    // Sync transactions
    const txnResult = await syncTransactions(itemId);

    // Liabilities → linked cards (issue #109). Best-effort: a liabilities
    // failure sweeps those cards to SYNC_FAILED (inside the sync) without
    // failing the accounts/transactions refresh above.
    let liabilitiesCardsUpdated: number | null = null;
    try {
      const liabilities = await syncLiabilitiesForItem(itemId, {
        userId: guard.session.user.id,
      });
      liabilitiesCardsUpdated = liabilities.cardsUpdated;
    } catch (liabilitiesError) {
      console.error(
        'Liabilities sync failed (non-blocking):',
        sanitizePlaidError(liabilitiesError)
      );
    }

    return NextResponse.json({
      success: true,
      accountsUpdated: accountResult.accountsUpdated,
      transactionsAdded: txnResult.added,
      transactionsModified: txnResult.modified,
      transactionsRemoved: txnResult.removed,
      liabilitiesCardsUpdated,
    });
  } catch (error) {
    console.error('Failed to sync:', error);
    return NextResponse.json(
      { error: 'Sync failed. Please try again.' },
      { status: 500 }
    );
  }
}
