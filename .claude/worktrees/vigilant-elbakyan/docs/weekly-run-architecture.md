# Weekly Run Architecture — Optimus Command Center

## Overview

The Weekly Optimus Run is the core automation pipeline. It executes every Sunday at 8pm as a single scheduled Claude task (the Optimus skill, ~413 lines). It is the SINGLE orchestrator — do not split it into multiple scheduled tasks.

Active scheduled tasks:
- 7am daily: QMD refresh
- 8am daily: Morning brief
- Sunday 8pm: Weekly Optimus Run (Phases 0–8)

Disabled tasks (functionality absorbed into Weekly Optimus Run):
- brain-daily-log, brain-granola-ingest, brain-weekly-synthesis, daily-feature-ideas, recipe-research-populate

---

## The 9-Phase Pipeline

### Phase 0: QMD Context Retrieval
Pull semantic context from prior weeks before doing anything else.
- `qmd query "last week optimus summary"` — what was done last week
- `qmd query "open commitments follow-ups"` — outstanding items
- `qmd query "active projects priorities"` — current focus
- Purpose: ground the run in history, avoid repeating work, surface continuity items

### Phase 1: Data Collection
Collect raw data from all active sources within the 7-day window.
- **Granola MCP** — extract meeting notes, people mentioned, commitments made
- **Airtable** — task registry state, project statuses, relationship records
- **Notion** — NOURISH workspace updates, project docs
- **Omi AI** — voice conversation transcripts (full transcripts, not summaries)
- **7-day window rule:** only pull data from the past 7 days. Do not reach back further unless a specific item is flagged as continuity from Phase 0.
- **Full transcripts rule:** always pull full Omi transcripts. Do not truncate or pre-summarize at this stage.

### Phase 2: Post-Processing — Brain Updates + Airtable Routing
Transform raw data into structured records.
- Write meeting summaries → Stefan-Brain (Obsidian vault at `C:\Users\stefa\Stefan-Brain`)
- Extract people mentioned → update Airtable People table (relationship health scores)
- Extract commitments → create Airtable task records with due dates
- Route SOPs → Airtable SOP table if a repeatable process was identified
- **Substantive content rule:** every brain entry must be substantive. Minimum ~200 words for meeting summaries, ~100 words for voice conversation summaries. No stub entries.

### Phase 3: Write Weekly JSON to Command Center
Generate the weekly data file for the Optimus dashboard.
- Output: `public/weeks/YYYY-MM-DD.json` (week starting Monday)
- Schema: `overview`, `lifeAdmin`, `ideas`, `skills` sections
- Pull from Airtable processed data (not raw sources)
- Auto-generate `executiveSummary`, `crossSourceAlignment`, `priorities`, `quickWins`
- **No overwrite rule:** never overwrite an existing week file. Each week is immutable once written.
- Regenerate `public/weeks/index.json` manifest after writing

### Phase 4: QMD Refresh
Re-index the brain so this week's additions are searchable.
- Run `qmd refresh` or equivalent to pick up new Obsidian files
- Confirm new entries appear in search before proceeding
- Purpose: next week's Phase 0 will find this week's context

### Phase 5: Brain LINT
Quality-check the brain entries written in Phase 2.
- Scan for stub entries (< 100 words)
- Scan for missing dates, missing people tags, missing project links
- Flag items that need enrichment
- Do NOT auto-delete or auto-merge — produce a lint report only
- Write lint findings to `jobs/review/brain-lint-YYYY-MM-DD.json`

### Phase 6: Slack Integration
Post the weekly summary to the appropriate Slack channel/DM.
- Format: brief executive summary (3–5 bullets), top 3 priorities, 1 quick win
- Include link to the Optimus dashboard week view
- Use the Slack MCP or Slack skill — do not use browser automation for this

### Phase 7: Skill Routing
Map identified tasks to the 80+ available skills for execution.
- Review `lifeAdmin` tasks from Phase 3
- For each task: identify if a skill exists that can execute it
- Create job packets in `jobs/inbox/` for skill-executable tasks
- Format: `{id, title, type, skill, inputs, expected_outputs, priority}`
- Do NOT execute the jobs — routing only. Human approves before execution.

### Phase 8: Skill Discovery
Find new automation candidates from this week's data.
- Review patterns in Phase 1 data: repeated manual steps, recurring question types
- Score each candidate: frequency × effort-saved × reliability
- Add high-score candidates to the `skills` section of the weekly JSON (Phase 3 output)
- Write discovery findings to `jobs/review/skill-discovery-YYYY-MM-DD.json`

---

## Mandatory Rules

### Commit-to-Main Rule
**Always commit directly to main. NEVER create worktree branches.**
Every pipeline output (weekly JSON, brain entries, job packets) must be committed immediately and pushed to `origin/main`. No staging branches, no worktrees, no PRs for pipeline outputs.

### 7-Day Window Rule
Phase 1 data collection is strictly bounded to the past 7 days. Do not pull older data unless Phase 0 explicitly surfaces a continuity item that requires it. This keeps each run focused and prevents duplicate processing.

### Full Transcripts Rule
Always pull full Omi AI transcripts in Phase 1. Never pre-summarize at collection time. Summarization happens in Phase 2 after full context is available.

### Substantive Content Rule
Brain entries written in Phase 2 must be substantive:
- Meeting summaries: minimum ~200 words
- Voice conversation summaries: minimum ~100 words
- No stub entries like "meeting with X" with no content

### Single Orchestrator Rule
The Optimus skill is the single orchestrator. Do not split the Weekly Run into multiple scheduled tasks. Consolidation was intentional — fragmented tasks lose context between phases.

---

## Error Handling

If a phase fails:
1. Log the failure with phase number, error, and timestamp to `jobs/review/weekly-run-error-YYYY-MM-DD.json`
2. Continue with remaining phases if possible (Phase 5–8 can run without Phase 1–4 being perfect)
3. Do NOT silently skip phases — always record what was skipped and why
4. On next run, Phase 0 QMD context will surface the incomplete run for follow-up

---

## Output Artifacts

| Phase | Output | Location |
|-------|--------|----------|
| 0 | Context notes (in-memory) | — |
| 1 | Raw source data (in-memory) | — |
| 2 | Brain entries, Airtable records | Stefan-Brain vault, Airtable |
| 3 | Weekly JSON + index update | `public/weeks/` |
| 4 | QMD index refresh | QMD search index |
| 5 | Lint report | `jobs/review/brain-lint-*.json` |
| 6 | Slack post | Slack channel |
| 7 | Job packets | `jobs/inbox/` |
| 8 | Discovery report | `jobs/review/skill-discovery-*.json` |
