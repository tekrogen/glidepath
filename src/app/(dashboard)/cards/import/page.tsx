/**
 * Card imports (issue #28 tracker · issue #48 Monarch balances). Server
 * shell for the two wizards behind a source selector: the proven tracker
 * flow stays untouched; the Monarch balances flow updates balances on
 * existing cards only. `?source=monarch` selects the second tab
 * (Settings deep-links it). Sign-in + financial:write gate — the actions
 * enforce it again server-side.
 */
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/auth/constants"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImportMonarchWizard } from "@/features/cards/components/import-monarch-wizard"
import { ImportTrackerWizard } from "@/features/cards/components/import-tracker-wizard"

export default async function ImportCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/cards/import")
  }
  if (!hasPermission(session.user.role, "financial:write")) {
    redirect("/overview")
  }
  const { source } = await searchParams
  const defaultTab = source === "monarch" ? "monarch" : "tracker"

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
          Cards · Onboarding
        </p>
        {/* Source-neutral since #48 — the page hosts two import flows. */}
        <h1 className="font-heading text-3xl font-bold tracking-tight">Import cards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bring your whole portfolio over from the spreadsheet, or refresh balances from a Monarch
          export — review first, then confirm.
        </p>
      </div>
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="tracker">Tracker workbook</TabsTrigger>
          <TabsTrigger value="monarch">Monarch balances</TabsTrigger>
        </TabsList>
        <TabsContent value="tracker" className="mt-4">
          <ImportTrackerWizard />
        </TabsContent>
        <TabsContent value="monarch" className="mt-4">
          <ImportMonarchWizard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
