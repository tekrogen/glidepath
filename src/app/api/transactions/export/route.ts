import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import { buildTransactionsCsv } from '@/features/transactions/server/export';

/** GET /api/transactions/export?range=90d&category=Food%20%26%20Dining */
export async function GET(request: Request) {
  const guard = await requirePermission('financial:export');
  if (!guard.success) return guard.response;

  const url = new URL(request.url);
  const range = url.searchParams.get('range') ?? '90d';
  const category = url.searchParams.get('category');

  const csv = await buildTransactionsCsv(guard.session.user.id, { range, category });

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="transactions-${range}.csv"`,
    },
  });
}
