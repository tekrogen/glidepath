# QA walkthrough guide (for testers)

You don't need any coding knowledge for this. You'll follow written test
tasks in a real browser, decide whether each one worked, and the tool
handles the paperwork — screenshots, notes, and the report.

The tool is in **beta** — at the end of every run it asks what was
confusing or missing about the tool itself. Please answer; that feedback
goes straight into the report.

## Before you start (one-time, with a developer)

Ask a developer (Marti) to:

1. Start the app and reset the demo data.
2. Give you the exact command to run, which looks like:

   ```
   pnpm qa:walkthrough <path-to-the-walkthrough-file>
   ```

Run it in a terminal from the project folder.

## What happens

1. The tool lists the walkthrough's open sections (for example a desktop
   pass and a phone pass) and asks which one to run. Press Enter for the
   first one.
2. It prints the section's setup notes, then — after you press Enter —
   opens a browser window and signs in for you.
3. It shows **one task at a time** in the terminal. Do what the task says
   in the browser window. Each task's "Expect:" text describes exactly
   what you should see.

**Phone-width tasks:** just drag the browser window narrower — the page
reflows like any normal browser, and screenshots capture exactly what you
see. No DevTools needed.

## The keys

At every task prompt:

| Key | What it does |
|---|---|
| **Enter** | Takes a screenshot of the browser tab you're looking at. Do this at every 📸 marker in the task, and whenever something looks wrong. Take as many as you like. |
| **p** | The task **passed** — what you saw matched the "Expect:" text. |
| **f** | The task **failed** — you'll type a short note describing what was different. |
| **s** | **Skip** the task for now (it stays marked as not done). |
| **b** | Go **back** to the previous task. Re-judging it replaces its earlier verdict. |

## The golden rules

- **You are the judge.** The tool never decides for you — if what you see
  doesn't match the "Expect:" text, that's a fail, even if it seems minor.
- **Don't fix, don't retry.** When something fails: screenshot it, press
  **f**, describe what you saw, and move on. Each failure becomes a
  GitHub issue for the development team.
- **You can stop anytime.** Progress is saved after every task. Closing
  the terminal early loses nothing — the report shows the remaining tasks
  as PENDING.

## Where everything goes

The tool prints both locations when it starts and again at the end:

- **Screenshots** — a timestamped folder; each capture also prints its
  path the moment you take it. At the end the tool offers to open the
  folder for you.
- **Findings report** — a file next to the walkthrough document with a
  table of every task, your verdict, your notes, and the screenshot names.

At the end, the tool offers to update the walkthrough document itself:
tasks you passed get their checkbox ticked, and a dated evidence table
with links to your screenshots is added at the bottom. Say **y** only if
you're happy with the run — a developer will review the change.
