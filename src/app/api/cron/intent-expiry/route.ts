import crypto from "crypto"
import { NextResponse } from "next/server"

import { expireStaleIntents } from "@/features/payments/server/service"

/**
 * Periodic cron: expire stale PaymentIntent drafts (issue #46; the
 * DRAFT→EXPIRED transition #45 deferred). Protected by CRON_SECRET header
 * — same idiom as plaid-cleanup. Each expiry emits PaymentIntentExpired
 * through the events seam (audit resource "payments").
 *
 * Schedule suggestion: hourly.
 * vercel.json: { "path": "/api/cron/intent-expiry", "schedule": "0 * * * *" }
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }

  // Timing-safe comparison to prevent secret extraction via timing attacks
  const authHeader = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${cronSecret}`
  const expectedBuf = Buffer.from(expected)
  const receivedBuf = Buffer.from(authHeader)
  if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  try {
    const { expired } = await expireStaleIntents(now)
    return NextResponse.json({ success: true, expired, ranAt: now.toISOString() })
  } catch (error) {
    console.error("Cron intent-expiry failed:", error)
    return NextResponse.json(
      { error: "Expiry failed", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }
}
