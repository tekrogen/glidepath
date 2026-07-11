import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import {
  exchangePublicToken,
  syncAccounts,
  syncTransactions,
  sanitizePlaidError,
} from '@/lib/services/plaid-service';

export async function POST(request: Request) {
  // Connects a new Plaid account — requires plaid:manage (USER).
  const guard = await requirePermission('plaid:manage');
  if (!guard.success) return guard.response;

  let body: { publicToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.publicToken || typeof body.publicToken !== 'string') {
    return NextResponse.json(
      { error: 'Missing publicToken.' },
      { status: 400 }
    );
  }

  try {
    const result = await exchangePublicToken(
      guard.session.user.id,
      body.publicToken
    );

    // Trigger initial sync: accounts first (creates FK records), then transactions
    try {
      await syncAccounts(result.itemId);
      await syncTransactions(result.itemId);
    } catch (syncError) {
      console.error(
        'Account/transaction sync failed (non-blocking):',
        sanitizePlaidError(syncError)
      );
    }

    return NextResponse.json({
      success: true,
      itemId: result.itemId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to connect account.';

    // Duplicate item detection — return 409 Conflict
    if (message.startsWith('DUPLICATE_ITEM:')) {
      return NextResponse.json(
        { error: message.replace('DUPLICATE_ITEM: ', '') },
        { status: 409 }
      );
    }

    console.error('Failed to exchange token:', sanitizePlaidError(error));
    return NextResponse.json(
      { error: 'Failed to connect account.' },
      { status: 500 }
    );
  }
}
