/**
 * Cards queries — auth-aware, request-cached entry points for pages
 * (arch doc §15). Pages call these; these call the service.
 */
import { cache } from "react"

import { getCardPortfolio } from "./service"

export const getPortfolioForUser = cache(async (userId: string) => {
  return getCardPortfolio(userId)
})
