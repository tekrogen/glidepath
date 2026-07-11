import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import { disconnectPlaidItem, deletePlaidItem } from '@/lib/services/plaid-service';

/** Disconnect — revoke Plaid access but keep local data */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  // Manages a Plaid connection — requires plaid:manage (USER).
  const guard = await requirePermission('plaid:manage');
  if (!guard.success) return guard.response;

  const { itemId } = await params;

  try {
    await disconnectPlaidItem(itemId, guard.session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to disconnect Plaid item:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect account.' },
      { status: 500 }
    );
  }
}

/** Delete — revoke Plaid access AND purge all local data */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  // Manages a Plaid connection — requires plaid:manage (USER).
  const guard = await requirePermission('plaid:manage');
  if (!guard.success) return guard.response;

  const { itemId } = await params;

  try {
    await deletePlaidItem(itemId, guard.session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete Plaid item:', error);
    return NextResponse.json(
      { error: 'Failed to delete account.' },
      { status: 500 }
    );
  }
}
