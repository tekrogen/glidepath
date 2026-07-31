/**
 * Generic QA-walkthrough companion (issues #143, #145) — v0.2.0-beta.
 *
 * Playwright is the chauffeur + stenographer, NOT the judge: it signs in and
 * keeps a headed browser open while the tester drives the UI and judges every
 * "Expect:" line. The script transcribes verdicts, captures screenshots of
 * the focused tab on demand, writes a findings record beside the QA record
 * (incrementally — quitting early loses nothing), and can update the QA
 * record itself: passed boxes flip to [x] and an evidence block linking the
 * screenshots is appended.
 *
 * Usage (dev server already running):
 *   pnpm qa:walkthrough admin/internal/reviews/<area>/<record>-qa.md
 *   pnpm qa:walkthrough            # prompts for the path
 *
 * Override the base URL with BASE=http://localhost:6020 (default is the
 * dev:https origin, https://localhost:6020).
 *
 * Tester-facing instructions live in scripts/qa/walkthrough-guide.md and in
 * the startup banner the script prints. Beta: each run ends with a prompt
 * for feedback about the tool itself, recorded in the findings file.
 */
import { execSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"

import { chromium } from "@playwright/test"

const VERSION = "0.2.0-beta"
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

// --- welcome ----------------------------------------------------------------

console.log(`
Glidepath QA walkthrough companion — v${VERSION}

You'll be shown one task at a time. Read it, then do what it says in the
browser window this tool opens (it signs you in first). Nothing is checked
automatically — YOU decide whether what you saw matched the task's
"Expect:" description.

At each task prompt:
  Enter   take a screenshot of the browser tab you're looking at
          (do this at every 📸 marker, or whenever something looks wrong —
          you can take as many as you like)
  p       the task PASSED — what you saw matched the description
  f       the task FAILED — you'll type a short note about what differed
  s       SKIP the task for now
  b       go BACK to the previous task (re-judging replaces its old verdict)

Your progress is saved to a findings file after every task, so closing the
terminal early loses nothing. When something fails, don't fix or retry —
screenshot it, mark f, describe it, and move on. Each failure becomes a
GitHub issue for the development team.

This tool is in beta: at the end you'll be asked for feedback about the
tool itself — anything confusing or missing goes straight into the report.
`)

// --- locate + parse the record ----------------------------------------------

let recordArg = process.argv[2]
if (!recordArg)
  recordArg = (await ask("Path to the QA record (.md) — your QA lead gives you this: ")).trim()
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

console.log(`Sections with open tasks in ${path.basename(RECORD)}:`)
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

// --- output locations (reviews/assets convention when available) -------------

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
const ASSETS_REL = path.relative(ROOT, ASSETS)
const FINDINGS = path.join(path.dirname(RECORD), `${STAMP}-${slug}-walkthrough-findings.md`)

// --- findings (rewritten after every task — early exit keeps progress) -------

const results = new Array(tasks.length).fill(null)
let toolFeedback = ""

const label = (t) => {
  const words = t.text.split(" ")
  return words.slice(0, 8).join(" ") + (words.length > 8 ? "…" : "")
}

function writeFindings() {
  const done = results.filter(Boolean)
  const failed = done.filter((r) => r.verdict === "FAIL")
  const skippedOrPending =
    done.some((r) => r.verdict === "SKIPPED") || done.length < tasks.length
  const md = [
    `# Walkthrough findings — ${section.heading}`,
    ``,
    `**Executed:** ${now.toISOString().slice(0, 10)} · **Record:** \`${path.basename(RECORD)}\` · **Tool:** walkthrough-companion v${VERSION} (Playwright drove sign-in + captures; all verdicts human)`,
    `**Screenshots:** \`${path.relative(path.dirname(FINDINGS), ASSETS)}/\``,
    ``,
    `| Task | Verdict | Note | Evidence |`,
    `|---|---|---|---|`,
    ...tasks.map((t, i) => {
      const r = results[i]
      return `| ${t.id} ${label(t)} | ${r?.verdict ?? "PENDING"} | ${r?.note || "—"} | ${r?.shots.join(", ") || "—"} |`
    }),
    ``,
    failed.length > 0
      ? `**Next:** file each FAIL as a GitHub issue (type:defect + severity), link it here, then check the record's boxes that passed.`
      : skippedOrPending
        ? `**Next:** no failures so far, but pending/skipped tasks remain — re-run them before checking their boxes.`
        : `**Next:** all tasks passed — check the record's boxes and update QA-WALKTHROUGH-LIST.md.`,
    ...(toolFeedback ? [``, `## Tool feedback (beta)`, ``, toolFeedback] : []),
    ``,
  ].join("\n")
  writeFileSync(FINDINGS, md)
}

// --- browser ------------------------------------------------------------------

console.log(`\nWalkthrough: ${section.heading}`)
console.log(`Base URL: ${BASE}`)
console.log(`Screenshots → ${ASSETS_REL}/`)
console.log(`Findings   → ${path.relative(ROOT, FINDINGS)} (saved after every task)`)
if (section.preamble.length > 0) {
  console.log("\nSection notes:")
  for (const line of section.preamble) console.log(wrap(line.trim()))
}
await ask("\nPress Enter to open the browser and begin… ")

mkdirSync(ASSETS, { recursive: true })

const browser = await chromium.launch({ headless: false, args: ["--window-size=1440,980"] })
// viewport: null — the page tracks the window like a normal browser, so
// testers can drag it narrow for responsive tasks and captures match what
// they see (a pinned viewport clips on resize and re-asserts itself over
// DevTools device emulation at screenshot time — #155).
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: null })
const page = await ctx.newPage()
await page.goto(BASE)

if ((await ask("Sign in as the demo user? [Y/n] ")).trim().toLowerCase() !== "n") {
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

let i = 0
while (i < tasks.length) {
  const task = tasks[i]
  console.log(`\n━━ Task ${i + 1} of ${tasks.length}`)
  console.log(wrap(task.text))
  const shots = results[i]?.shots ?? []
  let verdict
  let note = ""
  let goBack = false
  for (;;) {
    const input = (
      await ask("  [Enter]=screenshot · p=pass · f=fail · s=skip · b=back → ")
    )
      .trim()
      .toLowerCase()
    if (input === "") {
      const file = `task-${task.id}-${shots.length + 1}.png`
      await (await activePage()).screenshot({ path: path.join(ASSETS, file) })
      shots.push(file)
      console.log(`  📸 ${ASSETS_REL}/${file}`)
    } else if (input === "b") {
      if (i === 0) {
        console.log("  Already at the first task.")
        continue
      }
      goBack = true
      break
    } else if (input === "p" || input === "f" || input === "s") {
      verdict = { p: "PASS", f: "FAIL", s: "SKIPPED" }[input]
      if (input !== "p") note = (await ask("  Note (what didn't match / why skipped): ")).trim()
      break
    }
  }
  if (goBack) {
    results[i] = { ...(results[i] ?? {}), shots }
    i -= 1
    console.log(`  ↩ back to task ${i + 1} (its previous verdict will be overwritten when you re-judge).`)
    continue
  }
  results[i] = { verdict, note, shots }
  writeFindings()
  i += 1
}

await browser.close()

// --- beta feedback + summary ---------------------------------------------------

toolFeedback = (
  await ask(
    "\nBeta feedback — anything confusing or missing in this TOOL itself? (Enter to skip) ",
  )
).trim()
writeFindings()

const failedCount = results.filter((r) => r?.verdict === "FAIL").length
console.log(`\nFindings record: ${path.relative(ROOT, FINDINGS)}`)
console.log(`Screenshots:     ${ASSETS_REL}/`)
if (failedCount > 0)
  console.log(`${failedCount} FAIL task(s) — file them as issues (type:defect + severity).`)

// --- update the QA record: flip passed boxes, append evidence links ------------

const passed = tasks.filter((t, idx) => results[idx]?.verdict === "PASS")
if (
  passed.length > 0 &&
  (
    await ask(
      `Update the QA record now — flip ${passed.length} passed box(es) to [x] and append the evidence links? [y/N] `,
    )
  )
    .trim()
    .toLowerCase() === "y"
) {
  let record = readFileSync(RECORD, "utf8")
  for (const t of passed) {
    record = record.replace(t.firstLine, t.firstLine.replace("- [ ]", "- [x]"))
  }
  const shotsRel = path.relative(path.dirname(RECORD), ASSETS)
  const evidence = [
    ``,
    `### Walkthrough execution — ${section.heading} — ${now.toISOString().slice(0, 10)} (companion v${VERSION}; all verdicts human)`,
    ``,
    `Findings: \`${path.basename(FINDINGS)}\` · shots in \`${shotsRel}/\``,
    ``,
    `| Task | Verdict | Evidence |`,
    `|---|---|---|`,
    ...tasks.map((t, idx) => {
      const r = results[idx]
      const links = (r?.shots ?? []).map((f) => `[${f}](${shotsRel}/${f})`).join(" · ")
      return `| ${t.id} ${label(t)} | ${r?.verdict ?? "PENDING"}${r?.note ? ` — ${r.note}` : ""} | ${links || "—"} |`
    }),
    ``,
  ].join("\n")
  writeFileSync(RECORD, record.trimEnd() + "\n" + evidence)
  console.log("QA record updated — review the diff before relying on it.")
}

if (
  process.platform === "darwin" &&
  results.some((r) => (r?.shots.length ?? 0) > 0) &&
  (await ask("Open the screenshots folder in Finder? [y/N] ")).trim().toLowerCase() === "y"
) {
  execSync(`open "${ASSETS}"`)
}
rl.close()
