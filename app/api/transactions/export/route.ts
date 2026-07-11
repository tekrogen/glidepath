import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

const RANGE_DAYS: Record<string, number | null> = {
  '30d': 30,
  '90d': 90,
  '1y': 365,
  all: null,
};

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** GET /api/transactions/export?range=90d&category=Food%20%26%20Dining */
export async function GET(request: Request) {
  const guard = await requirePermission('financial:export');
  if (!guard.success) return guard.response;

  const url = new URL(request.url);
  const range = url.searchParams.get('range') ?? '90d';
  const category = url.searchParams.get('category');

  const days = RANGE_DAYS[range] ?? 90;
  const where = {
    userId: guard.session.user.id,
    ...(days ? { date: { gte: new Date(Date.now() - days * 86_400_000) } } : {}),
    ...(category ? { category } : {}),
  };

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: 'desc' },
    select: {
      date: true,
      description: true,
      merchant: true,
      category: true,
      subcategory: true,
      amount: true,
      type: true,
      status: true,
      account: { select: { name: true } },
    },
  });

  const header = 'Date,Description,Merchant,Category,Subcategory,Amount,Type,Status,Account';
  const rows = transactions.map((t) =>
    [
      t.date.toISOString().slice(0, 10),
      csvEscape(t.description),
      csvEscape(t.merchant ?? ''),
      csvEscape(t.category),
      csvEscape(t.subcategory ?? ''),
      Number(t.amount).toFixed(2),
      t.type,
      t.status,
      csvEscape(t.account.name),
    ].join(',')
  );

  const csv = [header, ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="transactions-${range}.csv"`,
    },
  });
}
