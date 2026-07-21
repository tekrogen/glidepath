/**
 * Payments — the Payment Runway calendar (issue #44, wireframe 1c: "the
 * calendar IS the interface; cards are lanes, due dates are the plot").
 * A pure composition layer (EDR-019): the service assembles engine
 * inputs, this page serializes them across the RSC boundary (bigint →
 * number cents), and the client view runs lib/finance itself so
 * optimistic reschedules recompute through the same single math path.
 */
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { getRunwayForUser, toRunwayViewProps, RunwayView } from "@/features/payments"

import { PaymentsFirstRun } from "./payments-first-run"

export const dynamic = "force-dynamic"

export default async function PaymentsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/payments")
  }

  const runway = await getRunwayForUser(session.user.id)

  if (runway.cards.length === 0) {
    return <PaymentsFirstRun />
  }

  return <RunwayView {...toRunwayViewProps(runway)} />
}
