/**
 * Delete-confirm dependents copy (issue #47/#57): "3 scheduled payments,
 * 1 statement and its autopay link" — or null when nothing rides with the
 * card. Pure string shaping; counts come from the household-scoped
 * dependents read.
 */
export interface CardDependentCounts {
  scheduledPaymentCount: number
  statementCount: number
  hasAutopayLink: boolean
}

export function dependentsSummary(deps: CardDependentCounts): string | null {
  const parts: string[] = []
  if (deps.scheduledPaymentCount > 0) {
    parts.push(
      `${deps.scheduledPaymentCount} scheduled payment${deps.scheduledPaymentCount === 1 ? "" : "s"}`
    )
  }
  if (deps.statementCount > 0) {
    parts.push(`${deps.statementCount} statement${deps.statementCount === 1 ? "" : "s"}`)
  }
  if (deps.hasAutopayLink) parts.push("its autopay link")
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
}
