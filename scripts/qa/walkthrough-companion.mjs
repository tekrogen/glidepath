/**
 * Generic QA-walkthrough companion (issue #143).
 *
 * Playwright is the chauffeur + stenographer, NOT the judge: it signs in and
 * keeps a headed browser open while YOU drive the UI and judge every
 * "Expect:" line. The script transcribes verdicts, captures screenshots of
 * the focused tab on demand, writes a timestamped findings record beside the
 * QA record, and can check off the boxes you passed.
 *
 * Usage (dev server already running):
 *   pnpm qa:walkthrough admin/internal/reviews/<area>/<record>-qa.md
 *   pnpm qa:walkthrough            # prompts for the path
 *
 * Override the base URL with BASE=http://localhost:6020 (default is the
 * dev:https origin, https://localhost:6020).
 *
 * At each task: perform the described actions in the browser, then at the
 * terminal press Enter to capture a screenshot of the focused tab (as many
 * as you like), and finish with p (pass), f (fail — you'll be asked for a
 * note), or s (skip). Failures become GitHub issues; checkbox state in the
 * record stays human attestation — nothing is verified by this script.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"

import { chromium } from "@playwright/test"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const BASE = process.env.BASE ?? "https://localhost:6020"

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => rl.question(q)

const wrap = (text, indent = "  ", width = 100) =>
  text
    .split(/\s+/)
    .reduce(
      (lines, word) => {
        const last = lines[lines.length - 1]
        if ((last + " " + word).length > width) lines.push(indent + word)
        else lines[lines.length - 1] = last === indent ? indent + word : `${last} ${word}`
        return lines
      },
      [indent],
    )
    .join("\n")

// --- locate + parse the record ---------------------------------------------

let recordArg = process.argv[2]
if (!recordArg) recordArg = (await ask("Path to the QA record (.md): ")).trim()
const RECORD = path.resolve(ROOT, recordArg)
if (!existsSync(RECORD)) {
  console.error(`No such file: ${RECORD}`)
  process.exit(1)
}

const recordText = readFileSync(RECORD, "utf8")
const recordLines = recordText.split("\n")

/**
 * A section = a `#`-heading plus its body. A task = an unchecked `- [ ]`
 * item, including indented continuation lines. Everything else in the
 * section body is preamble (Setup / Getting there), shown before the run.
 */
const sections = []
let current = null
for (const line of recordLines) {
  const heading = line.match(/^#{1,4} (.+)/)
  if (heading) {
    current = { heading: heading[1].trim(), tasks: [], preamble: [] }
    sections.push(current)
    continue
  }
  if (!current) continue
  if (/^\s*- \[ \]/.test(line)) {
    current.tasks.push({ raw: [line] })
  } else if (/^\s{2,}\S/.test(line) && current.tasks.length > 0 && !/^\s*- \[/.test(line)) {
    current.tasks[current.tasks.length - 1].raw.push(line)
  } else if (line.trim() && !/^\s*- \[x\]/i.test(line)) {
    current.preamble.push(line)
  }
}

const runnable = sections.filter((s) => s.tasks.length > 0)
if (runnable.length === 0) {
  console.log("No unchecked `- [ ]` tasks in that record — nothing to walk through.")
  process.exit(0)
}

console.log(`\nSections with open tasks in ${path.basename(RECORD)}:`)
runnable.forEach((s, i) => console.log(`  ${i + 1}. ${s.heading} (${s.tasks.length} open)`))
const pick = Number((await ask(`Run which section? [1-${runnable.length}, default 1] `)).trim() || "1")
const section = runnable[pick - 1] ?? runnable[0]

const tasks = section.tasks.map((t, i) => ({
  id: String(i + 1).padStart(2, "0"),
  firstLine: t.raw[0],
  text: t.raw
    .join(" ")
    .replace(/^\s*- \[ \]\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim(),
}))

// --- output locations (reviews/assets convention when available) ------------

const now = new Date()
const pad = (n) => String(n).padStart(2, "0")
const STAMP = `${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`
const slug = path
  .basename(RECORD, ".md")
  .replace(/^\d+-/, "")
  .replace(/-qa$/i, "")

let reviewsDir = path.dirname(RECORD)
while (path.basename(reviewsDir) !== "reviews" && reviewsDir !== path.dirname(reviewsDir)) {
  reviewsDir = path.dirname(reviewsDir)
}
const assetsBase =
  path.basename(reviewsDir) === "reviews" ? path.join(reviewsDir, "assets") : path.dirname(RECORD)
const ASSETS = path.join(assetsBase, `${STAMP}-walkthrough-${slug}`)
const FINDINGS = path.join(path.dirname(RECORD), `${STAMP}-${slug}-walkthrough-findings.md`)

// --- browser ----------------------------------------------------------------

console.log(`\nWalkthrough: ${section.heading}`)
console.log(`Base URL: ${BASE}  ·  screenshots → ${path.relative(ROOT, ASSETS)}/`)
if (section.preamble.length > 0) {
  console.log("\nSection notes:")
  for (const line of section.preamble) console.log(wrap(line.trim()))
}

mkdirSync(ASSETS, { recursive: true })

const browser = await chromium.launch({ headless: false })
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.goto(BASE)

if ((await ask("\nSign in as the demo user? [Y/n] ")).trim().toLowerCase() !== "n") {
  await page.goto(`${BASE}/signin`)
  await page.getByLabel("Email").fill("demo@glidepath.cards")
  await page.getByLabel("Password").fill("demo-password")
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL(/overview|dashboard/)
  console.log("Signed in as the demo user.")
}

/** The page whose document has focus — the tab the tester is looking at. */
async function activePage() {
  for (const p of ctx.pages()) {
    if (p.isClosed()) continue
    try {
      if (await p.evaluate(() => document.hasFocus())) return p
    } catch {
      /* page navigating — skip it */
    }
  }
  const open = ctx.pages().filter((p) => !p.isClosed())
  return open[open.length - 1] ?? page
}

const results = []
for (const task of tasks) {
  console.log(`\n━━ Task ${task.id} of ${tasks.length}`)
  console.log(wrap(task.text))
  const shots = []
  let verdict
  let note = ""
  for (;;) {
    const input = (
      await ask("  [Enter]=capture screenshot of the focused tab · p=pass · f=fail · s=skip → ")
    )
      .trim()
      .toLowerCase()
    if (input === "") {
      const file = `task-${task.id}-${shots.length + 1}.png`
      await (await activePage()).screenshot({ path: path.join(ASSETS, file) })
      shots.push(file)
      console.log(`  📸 ${file}`)
    } else if (input === "p" || input === "f" || input === "s") {
      verdict = { p: "PASS", f: "FAIL", s: "SKIPPED" }[input]
      if (input !== "p") note = (await ask("  Note (what didn't match / why skipped): ")).trim()
      break
    }
  }
  results.push({ ...task, verdict, note, shots })
}

await browser.close()

// --- findings record --------------------------------------------------------

const failed = results.filter((r) => r.verdict === "FAIL")
const skipped = results.filter((r) => r.verdict === "SKIPPED")
const label = (t) => {
  const words = t.text.split(" ")
  return words.slice(0, 8).join(" ") + (words.length > 8 ? "…" : "")
}
const md = [
  `# Walkthrough findings — ${section.heading}`,
  ``,
  `**Executed:** ${now.toISOString().slice(0, 10)} · **Record:** \`${path.basename(RECORD)}\` (companion-assisted: Playwright drove sign-in + captures; all verdicts human)`,
  `**Screenshots:** \`${path.relative(path.dirname(FINDINGS), ASSETS)}/\``,
  ``,
  `| Task | Verdict | Note | Evidence |`,
  `|---|---|---|---|`,
  ...results.map(
    (r) => `| ${r.id} ${label(r)} | ${r.verdict} | ${r.note || "—"} | ${r.shots.join(", ") || "—"} |`,
  ),
  ``,
  failed.length > 0
    ? `**Next:** file each FAIL as a GitHub issue (type:defect + severity), link it here, then check the record's boxes that passed.`
    : skipped.length > 0
      ? `**Next:** no failures, but skipped tasks remain unexecuted — re-run them before checking their boxes.`
      : `**Next:** all tasks passed — check the record's boxes and update QA-WALKTHROUGH-LIST.md.`,
  ``,
].join("\n")
writeFileSync(FINDINGS, md)
console.log(`\nFindings record written: ${path.relative(ROOT, FINDINGS)}`)
if (failed.length > 0)
  console.log(`${failed.length} FAIL task(s) — file them as issues (type:defect + severity).`)

// --- offer to check off the passed boxes ------------------------------------

const passed = results.filter((r) => r.verdict === "PASS")
if (
  passed.length > 0 &&
  (await ask(`Mark the ${passed.length} passed box(es) in ${path.basename(RECORD)}? [y/N] `))
    .trim()
    .toLowerCase() === "y"
) {
  let updated = readFileSync(RECORD, "utf8")
  for (const r of passed) {
    updated = updated.replace(r.firstLine, r.firstLine.replace("- [ ]", "- [x]"))
  }
  writeFileSync(RECORD, updated)
  console.log("Record updated — review the diff before relying on it.")
}
rl.close()
