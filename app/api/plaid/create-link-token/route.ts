import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import {
  createLinkToken,
  createUpdateModeLinkToken,
  isPlaidConfigured,
} from '@/lib/services/plaid-service';
import { prisma } from '@/lib/db/prisma';
import { decrypt } from '@/lib/utils/encryption';

export async function POST(request: Request) {
  // Manages Plaid connections — requires plaid:manage (USER).
  const guard = await requirePermission('plaid:manage');
  if (!guard.success) return guard.response;

  // Graceful degradation: the app runs keyless in demo mode
  if (!isPlaidConfigured()) {
    return NextResponse.json(
      {
        error:
          'Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to your .env file — see SETUP.md.',
        code: 'PLAID_NOT_CONFIGURED',
      },
      { status: 503 }
    );
  }

  try {
    // Check for optional itemId (update mode)
    let itemId: string | undefined;
    try {
      const body = await request.json();
      itemId = body.itemId;
    } catch {
      // No body or invalid JSON — proceed with normal link token
    }

    let linkToken: string;

    if (itemId) {
      // Update mode: look up the PlaidItem and create an update-mode link token
      const plaidItem = await prisma.plaidItem.findFirst({
        where: { id: itemId, userId: guard.session.user.id },
      });

      if (!plaidItem) {
        return NextResponse.json(
          { error: 'Plaid connection not found' },
          { status: 404 }
        );
      }

      const accessToken = decrypt(plaidItem.accessToken);
      linkToken = await createUpdateModeLinkToken(guard.session.user.id, accessToken);
    } else {
      // Normal mode: create a fresh link token
      linkToken = await createLinkToken(guard.session.user.id);
    }

    return NextResponse.json({ linkToken });
  } catch (error: unknown) {
    console.error('Failed to create link token:', error);

    // Extract Plaid-specific error details from axios response
    let message = 'Failed to initialize Plaid Link.';
    const err = error as { response?: { data?: { error_message?: string; error_code?: string; error_type?: string } }; message?: string };
    if (err.response?.data?.error_message) {
      message = `${err.response.data.error_type}: ${err.response.data.error_code} — ${err.response.data.error_message}`;
    } else if (err.message) {
      message = err.message;
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
