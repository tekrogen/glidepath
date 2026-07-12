/**
 * Theme-token audit: reads the computed CSS custom properties and fonts
 * from the LIVE app (light + dark) so they can be diffed against the
 * canonical theme file (admin/internal/theme/css/styles.css).
 */
import { chromium } from "@playwright/test"

const TOKENS = [
  "--background",
  "--foreground",
  "--card",
  "--primary",
  "--secondary",
  "--accent",
  "--muted",
  "--muted-foreground",
  "--border",
  "--destructive",
  "--success",
  "--radius",
]

const browser = await chromium.launch()
const out = {}
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ colorScheme: scheme })
  const page = await ctx.newPage()
  await page.goto("http://localhost:6014/signin")
  await page.getByLabel("Email").fill("demo@creditcardmanager.app")
  await page.getByLabel("Password").fill("demo-password")
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL(/dashboard|overview/)
  await page.goto("http://localhost:6014/overview", { waitUntil: "networkidle" })
  out[scheme] = await page.evaluate((tokens) => {
    const cs = getComputedStyle(document.documentElement)
    const r = {}
    for (const t of tokens) r[t] = cs.getPropertyValue(t).trim()
    r["data-theme"] = document.documentElement.getAttribute("data-theme") ?? "(unset → :root defaults)"
    r["html.class"] = document.documentElement.className
    r["body font-family"] = getComputedStyle(document.body).fontFamily.split(",")[0].trim()
    const h1 = document.querySelector("h1")
    r["h1 font-family"] = h1 ? getComputedStyle(h1).fontFamily.split(",")[0].trim() : "?"
    return r
  }, TOKENS)
  await ctx.close()
}
await browser.close()
console.log(JSON.stringify(out, null, 2))
