import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { getUserPlaidItems } from '@/lib/services/plaid-service';

export async function GET() {
  const guard = await requireAuth();
  if (!guard.success) return guard.response;

  try {
    const items = await getUserPlaidItems(guard.session.user.id);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Failed to fetch Plaid items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connected accounts.' },
      { status: 500 }
    );
  }
}
