import { chromium } from "@playwright/test"
const SCRATCH = process.env.SCRATCH ?? "."
const browser = await chromium.launch()
const scheme = process.env.SCHEME === "dark" ? "dark" : "light"
const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1400, height: 1000 } })
const page = await ctx.newPage()
await page.goto("http://localhost:6014/signin")
await page.getByLabel("Email").fill("demo@glidepath.cards")
await page.getByLabel("Password").fill("demo-password")
await page.getByRole("button", { name: "Sign in" }).click()
await page.waitForURL(/dashboard|overview/)
for (const [route, name] of [["/overview", "overview"], ["/cards", "cards"]]) {
  await page.goto(`http://localhost:6014${route}`, { waitUntil: "networkidle" })
  await page.screenshot({ path: `${SCRATCH}/${scheme}-${name}.png`, fullPage: true })
}
await browser.close()
console.log("shots done")
