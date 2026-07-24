/**
 * Payment scheduling stepper (issue #45, Blueprint F6 — "payment
 * scheduling" at /payments/new). A pure composition layer: the service
 * assembles cards + funding accounts + the resumable draft, this page
 * serializes across the RSC boundary, the client stepper owns the flow.
 */
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { getPaymentSetupForUser, toPaymentStepperProps } from "@/features/payments"
import { PaymentStepper } from "@/features/payments/components/payment-stepper"

export const dynamic = "force-dynamic"

export default async function NewPaymentPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/payments/new")
  }

  const setup = await getPaymentSetupForUser(session.user.id)

  // No cards → nothing to schedule; the runway's first-run explains.
  if (setup.cards.length === 0) {
    redirect("/payments")
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Payment scheduling
        </p>
        <h1 className="font-heading text-4xl font-bold tracking-tight">Schedule a payment</h1>
      </div>
      <PaymentStepper {...toPaymentStepperProps(setup)} />
    </div>
  )
}
