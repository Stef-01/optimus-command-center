---
title: "feat: weekly-creation-map — Sunday 21:00 creation audit agent"
type: feat
status: active
date: 2026-04-14
---

# feat: weekly-creation-map — Sunday 21:00 creation audit agent

## Overview

A new weekly scheduled task (`weekly-creation-map`) that fires every Sunday at 21:00 local time (one hour after the main Optimus Weekly Run at 20:00). It aggregates everything Stefan created or touched in the past 7 days across three data sources (SQLite state store, git logs, new wiki files), groups items by Obsidian macro category, and writes a toggle-callout map to `wiki/sources/weekly-creation-map-YYYY-MM-DD.md`.

This is the **introspective** complement to the Optimus Weekly Run — while the Weekly Run synthesizes *what happened*, the creation map audits *what was built*.

## Problem Frame

Stefan's creation output is scattered across three repos, multiple wiki directories, and the knowledge-graph state store. No single view answers "what did I actually ship this week?" The creation map consolidates this into a scannable Obsidian document grouped by macro category.

## Data Sources

1. **SQLite state store** — `C:\Users\stefa\Stefan-Brain\wiki\_log\state.db` via `python scripts/kg-log/query.py --since <7d-ago> --format json`
2. **Git logs** — `git log --since="7 days ago" --oneline --name-status` in:
   - `C:\Users\stefa\Sous`
   - `C:\Users\stefa\optimus-command-center`
   - `C:\Users\stefa\Stefan-Brain`
3. **New wiki files** — files with mtime in last 7 days in:
   - `wiki/meetings/`
   - `wiki/sources/`
   - `wiki/entities/`
   - `wiki/_inbox/`
   - `wiki/_log/inbox-signal/`

## Macro Categories

| Category | What counts |
|----------|-------------|
| Projects | Commits/sessions touching project repos (Sous, NOURISH, optimus-command-center) |
| Meetings | New files in `wiki/meetings/` |
| Sources | New files in `wiki/sources/` (grant scans, omi extracts, inbox signals) |
| People | New files in `wiki/entities/`, unresolved-people.md changes |
| Logs | New entries in `wiki/_log/`, sessions from SQLite |
| Code | Git commits with file-level changes across all 3 repos |
| Patterns | Patterns table entries from SQLite (if any) |

## Output Format

Obsidian toggle callouts per category:

```markdown
> [!summary]- Projects (4 items)
> - [[optimus-command-center]] — 3 commits: inbox-signal agent, hooks, ...
> - [[sous]] — 1 commit: recipe endpoint fix
```

## Key Technical Decisions

- **Runs at 21:00** — one hour after the 20:00 Weekly Run, so creation map can reference that week's data
- **No Airtable/Notion dependency** — purely file-system + SQLite + git, runs without MCP auth
- **Idempotent by date** — same Sunday re-run overwrites the same file
- **Integrates with Optimus brief** — appends a `## Creation Map` section link to the weekly JSON if it exists

## Implementation Units

- [x] **Unit 1: Plan document** — this file
- [x] **Unit 2: Scheduled task** — `weekly-creation-map` via create_scheduled_task, cron `0 21 * * 0`
- [ ] **Unit 3: Smoke test** — manual run with this week's real data
- [ ] **Unit 4: Commit** — both repos to main

## Scope Boundaries

- No Airtable or Notion queries (Phase 2)
- No Slack posting (handled by Weekly Run Phase 6)
- No stranded-project detection (deferred — step 4 explicitly excluded)
