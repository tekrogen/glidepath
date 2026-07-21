/**
 * Payments queries — auth-aware, request-cached entry points for pages
 * (arch doc §15). Pages call these; these call the service.
 */
import { cache } from "react"

import { getPaymentRunway } from "./service"

export const getRunwayForUser = cache(async (userId: string) => {
  return getPaymentRunway(userId)
})
