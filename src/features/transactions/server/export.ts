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

/** Build the transactions CSV for a user, honoring the same range/category filters as the page. */
export async function buildTransactionsCsv(
  userId: string,
  opts: { range: string; category: string | null }
): Promise<string> {
  const days = RANGE_DAYS[opts.range] ?? 90;
  const where = {
    userId,
    ...(days ? { date: { gte: new Date(Date.now() - days * 86_400_000) } } : {}),
    ...(opts.category ? { category: opts.category } : {}),
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

  return [header, ...rows].join('\n');
}
