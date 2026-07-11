/**
 * EstimatedValue — the "~" provenance convention (EDR-020).
 *
 * Every dollar figure derived from estimates (simple-interest math,
 * unconfirmed APR/limit/minimum inputs) renders through this component so
 * the "~" prefix and its explanation never drift apart.
 */
export function EstimatedValue({
  children,
  reason = "Estimated — simple monthly interest (balance × APR ÷ 12), not the issuer's exact method.",
  className = "",
}: {
  children: React.ReactNode
  reason?: string
  className?: string
}) {
  return (
    <span
      className={`cursor-help ${className}`}
      title={reason}
      aria-label={`Estimated value. ${reason}`}
    >
      ~{children}
    </span>
  )
}
