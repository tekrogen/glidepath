import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import {
  syncAccounts,
  syncTransactions,
  updateItemWebhook,
} from '@/lib/services/plaid-service';
import { prisma } from '@/lib/db/prisma';

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

    return NextResponse.json({
      success: true,
      accountsUpdated: accountResult.accountsUpdated,
      transactionsAdded: txnResult.added,
      transactionsModified: txnResult.modified,
      transactionsRemoved: txnResult.removed,
    });
  } catch (error) {
    console.error('Failed to sync:', error);
    return NextResponse.json(
      { error: 'Sync failed. Please try again.' },
      { status: 500 }
    );
  }
}
