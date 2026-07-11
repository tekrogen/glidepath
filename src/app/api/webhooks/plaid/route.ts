import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';
import { handlePlaidWebhook } from '@/lib/services/plaid-service';
import { verifyPlaidWebhook } from '@/lib/services/plaid-webhook-verifier';

/**
 * Plaid Webhook Receiver
 *
 * No auth guard — Plaid sends webhooks directly.
 * Webhook signature is verified using Plaid's JWT/JWK verification.
 */
export async function POST(request: Request) {
  // Read raw body text BEFORE parsing JSON (needed for SHA-256 verification)
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Could not read body' }, { status: 400 });
  }

  // Verify webhook signature. Always runs — the verifier itself is the sole
  // authority on whether a request may be skipped (explicit dev opt-in only).
  // Gating on PLAID_WEBHOOK_URL here would silently disable verification on any
  // deployment missing that var, which is strictly weaker than failing closed.
  const verification = await verifyPlaidWebhook(rawBody, request.headers);
  if (!verification.verified) {
    console.warn('Plaid webhook verification failed:', verification.reason);

    await prisma.auditLog.create({
      data: {
        action: 'PLAID_WEBHOOK',
        resource: 'webhook_verification',
        details: JSON.stringify({
          reason: verification.reason,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
        }),
        success: false,
      },
    });

    return NextResponse.json({ error: 'Verification failed' }, { status: 401 });
  }

  // Parse the verified body
  let body: {
    webhook_type?: string;
    webhook_code?: string;
    item_id?: string;
  };

  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { webhook_type, webhook_code, item_id } = body;

  if (!webhook_type || !webhook_code || !item_id) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  try {
    const { action, result } = await handlePlaidWebhook(webhook_type, webhook_code, item_id);
    return NextResponse.json({ received: true, action, result });
  } catch (error) {
    console.error('Webhook processing error:', error);

    // Log processing failure
    await prisma.auditLog.create({
      data: {
        action: 'PLAID_WEBHOOK',
        resource: `PlaidItem:${item_id}`,
        details: JSON.stringify({
          webhookType: webhook_type,
          webhookCode: webhook_code,
          error: error instanceof Error ? error.message : 'unknown',
        }),
        success: false,
      },
    });

    // Return 200 so Plaid doesn't retry for non-transient errors
    return NextResponse.json({ received: true, error: 'Processing failed' });
  }
}
