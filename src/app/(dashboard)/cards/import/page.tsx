/**
 * Tracker import (issue #28, EDR-021 step 2). Server shell for the wizard:
 * sign-in + financial:write gate (the actions enforce it again server-side),
 * page header per the Cards idiom.
 */
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/constants"
import { ImportTrackerWizard } from "@/features/cards/components/import-tracker-wizard"

export default async function ImportTrackerPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/cards/import")
  }
  if (!hasPermission(session.user.role, "financial:write")) {
    redirect("/overview")
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
          Cards · Onboarding
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Import your tracker</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bring your whole portfolio over from the spreadsheet in one pass — review first, then
          confirm.
        </p>
      </div>
      <ImportTrackerWizard />
    </div>
  )
}
