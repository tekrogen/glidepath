import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getPlaidClient, plaidCredentials } from '@/lib/services/plaid-service';
import { decrypt } from '@/lib/utils/encryption';

/**
 * Periodic cron: clean up expired and long-disconnected PlaidItems.
 * Protected by CRON_SECRET header.
 *
 * Actions:
 * 1. Disconnected items older than 30 days → delete rows (data already purged at disconnect time)
 * 2. Expired consent items (consentExpiresAt in the past) → revoke at Plaid, delete row, audit log
 *
 * Schedule suggestion: daily at 6 AM UTC
 * vercel.json: { "path": "/api/cron/plaid-cleanup", "schedule": "0 6 * * *" }
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  // Timing-safe comparison to prevent secret extraction via timing attacks
  const authHeader = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${cronSecret}`;
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(authHeader);
  if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  let disconnectedCleaned = 0;
  let expiredCleaned = 0;

  try {
    // 1. Clean up long-disconnected items (data was already purged at disconnect time)
    const disconnected = await prisma.plaidItem.findMany({
      where: {
        status: 'DISCONNECTED',
        updatedAt: { lt: thirtyDaysAgo },
      },
    });

    if (disconnected.length > 0) {
      await prisma.plaidItem.deleteMany({
        where: {
          id: { in: disconnected.map((i) => i.id) },
        },
      });
      disconnectedCleaned = disconnected.length;
    }

    // 2. Clean up expired consent items
    const expired = await prisma.plaidItem.findMany({
      where: {
        consentExpiresAt: { lt: now },
        status: { not: 'DISCONNECTED' },
      },
    });

    const client = getPlaidClient();

    for (const item of expired) {
      // Revoke access at Plaid
      try {
        const accessToken = decrypt(item.accessToken);
        await client.itemRemove({
          ...plaidCredentials(),
          access_token: accessToken,
        });
      } catch {
        // Token may already be invalid — continue cleanup
      }

      // Delete the row
      await prisma.plaidItem.delete({
        where: { id: item.id },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: item.userId,
          action: 'PLAID_CONSENT_EXPIRED',
          resource: `PlaidItem:${item.id}`,
          details: JSON.stringify({
            institutionName: item.institutionName,
            consentExpiresAt: item.consentExpiresAt,
          }),
          success: true,
        },
      });

      expiredCleaned++;
    }

    return NextResponse.json({
      success: true,
      disconnectedCleaned,
      expiredCleaned,
      cleanedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Cron plaid-cleanup failed:', error);
    return NextResponse.json(
      { error: 'Cleanup failed', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
