---
title: "feat: inbox-signal-stanford — Stanford Outlook daily email ingest agent"
type: feat
status: active
date: 2026-04-14
---

# feat: inbox-signal-stanford — Stanford Outlook daily email ingest agent

## Overview

A new daily scheduled task (`inbox-signal-stanford`) that opens Stefan's Stanford Outlook via the always-on PC's Claude in Chrome extension, extracts the last 7 days of inbox messages, pre-filters to keep only signal-worthy threads, classifies each kept message, writes structured output to Stefan-Brain (wiki/sources/ + wiki/_log/), queues unknown senders to wiki/_inbox/unresolved-people.md, and commits everything. Runs at 08:00 local time.

This is the first **exogenous** source in the Optimus pipeline (all other sources — Granola, Omi, Airtable, Notion — are endogenous). Purpose is creative signal and relationship awareness, NOT triage.

## Problem Frame

Stefan's Outlook inbox contains weak signals that never make it into Optimus: collaborator outreach, emerging opportunities (CFPs, fellowships), orphaned threads. The weekly run's Phase 1 doesn't yet pull email. This agent bridges that gap with a daily cadence.

## Requirements Trace

- R1. Use Chrome extension MCP tools (mcp__Claude_in_Chrome__*) — no Microsoft Graph OAuth, no Outlook MCP
- R2. Scheduled via scheduled-tasks system at 08:00 local — cron `0 8 * * *`
- R3. Stanford Outlook only (outlook.office.com) — no login automation; if session expired, log diagnostic and exit
- R4. Pre-filter hard: keep collaborators (replied-to in 90 days), newsletter allowlist, project vocab match, orphans >7 days old
- R5. Extract per-message: sender_name, sender_email, subject, date, snippet (~300 chars), thread_status, classification
- R6. Classify: collaborator / newsletter / orphan / opportunity
- R7. Primary output → wiki/sources/inbox-signal-YYYY-MM-DD.md (Stefan-Brain, same format as grant-scan/omi-extract)
- R8. Durable copy → wiki/_log/inbox-signal/YYYY-MM-DD.md with wikilinks to matched entities
- R9. knowledge-graph-logger entry → wiki/_log/YYYY-MM-DD.md (standard daily log)
- R10. Unknown senders → wiki/_inbox/unresolved-people.md (append, same pattern as flow1_ingest.py)
- R11. Commit Stefan-Brain main after each run
- R12. Phase 2 notes documented in README — no attachment extraction, no Granola cross-ref yet

## Scope Boundaries

- No login automation — if not authenticated, exit gracefully
- No attachment extraction (Phase 2)
- No Granola cross-reference (Phase 2)
- No theme drift tracking (Phase 2)
- Newsletter allowlist starts empty — documented how to add, not populated
- No Airtable write (email context stays in Stefan-Brain only at Phase 1)

## Context & Research

### Relevant Code and Patterns

- `wiki/sources/grant-scan-2026-04-13.md` — canonical source file format (Obsidian YAML frontmatter, sections, stats block)
- `wiki/sources/omi-extract-2026-04-13.md` — another source pattern, with stats table
- `log.md` (Stefan-Brain root) — append-only operation log format: `## [YYYY-MM-DD] OPERATION — description`
- `scripts/commitment-capture/flow1_ingest.py` — entity fuzzy-matching against wiki/entities/ aliases, unresolved-people.md pattern
- `wiki/_inbox/unresolved-people.md` — doesn't exist yet; will be created by inbox-signal on first run
- `wiki/_log/` — doesn't exist yet; knowledge-graph-logger creates it per the skill spec
- `wiki/_log/inbox-signal/` — new per-agent subfolder; scaffolded as part of this work

### Institutional Learnings

- Scheduled tasks store SKILL.md at `C:\Users\stefa\.claude\scheduled-tasks\<taskId>\SKILL.md`
- knowledge-graph-logger writes to `wiki/_log/YYYY-MM-DD.md` (daily flat file) — separate from the per-agent `wiki/_log/inbox-signal/YYYY-MM-DD.md` copy
- Stefan-Brain entity pages use regex-safe YAML extraction (not PyYAML) to handle [[wiki link]] frontmatter
- All agents commit to main immediately — no staging branches

## Key Technical Decisions

- **Chrome extraction strategy**: Use `javascript_tool` for structured DOM extraction; fall back to `get_page_text` + Claude parsing if JS fails. Outlook's ARIA roles (`[role="option"]`, `[role="listitem"]`) are more stable than obfuscated CSS classes.
- **Reply history (90 days)**: Navigate to Sent Items, search `sent:>CUTOFF_DATE`, extract unique TO: addresses. Builds `REPLIED_TO_SET` in-session.
- **No external config files**: Allowlist embedded directly in SKILL.md as a clearly-marked array. To add: edit SKILL.md.
- **Primary output location**: `wiki/sources/inbox-signal-YYYY-MM-DD.md` — follows grant-scan convention; weekly run Phase 1 can pick it up.
- **knowledge-graph-logger**: Invoked inline at end of task (not a separate step); writes to `wiki/_log/YYYY-MM-DD.md`.
- **Classification priority**: collaborator > opportunity > newsletter > orphan. A message can match multiple rules; highest priority wins.

## Open Questions

### Resolved During Planning

- "Optimus ingestion folder" = `wiki/sources/` in Stefan-Brain (matches grant-scan/omi-extract pattern)
- knowledge-graph-logger is a real installed skill; follow its exact protocol
- `wiki/_log/inbox-signal/YYYY-MM-DD.md` is a separate per-agent durable record; `wiki/_log/YYYY-MM-DD.md` is the standard daily log entry
- soul.md not found → "soul-law" = existing commit-to-main bulletproof rule already in Stefan-Brain CLAUDE.md

### Deferred to Implementation

- Exact JS selectors for Outlook DOM (Outlook's DOM structure known at runtime, not planning time)
- Whether Outlook search supports `received:>` syntax (standard Outlook Web filter — likely yes, but Claude adapts if not)

## High-Level Technical Design

> *Directional guidance for review, not implementation specification.*

```
08:00 CRON fires
    │
    ▼
Pre-flight: Chrome ext + auth check
    │ (fail) → log.md diagnostic + exit
    │ (ok)
    ▼
Phase 1: Scrape Sent Items (90d)
    → REPLIED_TO_SET = {emails Stefan replied to}
    │
    ▼
Phase 2: Scrape Inbox (7d)
    → raw_messages = [{sender, subject, date, snippet, thread_status}]
    │
    ▼
Phase 3: Pre-filter + classify
    → kept_messages = subset with class assigned
    │
    ▼
Phase 4: Entity match (wiki/entities/)
    → add entity_wikilink where sender matches
    → UNRESOLVED_SENDERS = unmatched
    │
    ├──► wiki/sources/inbox-signal-YYYY-MM-DD.md (primary)
    ├──► wiki/_log/inbox-signal/YYYY-MM-DD.md (copy + wikilinks)
    ├──► wiki/_log/YYYY-MM-DD.md (knowledge-graph-logger append)
    └──► wiki/_inbox/unresolved-people.md (append unknown senders)
    │
    ▼
git add -A && git commit && git push (Stefan-Brain main)
```

## Implementation Units

- [x] **Unit 1: Plan document**

**Goal:** Document architecture and decisions.
**Files:** `docs/plans/2026-04-14-001-feat-inbox-signal-stanford-plan.md`
**Test expectation:** none — documentation only.

---

- [ ] **Unit 2: Stefan-Brain scaffolding**

**Goal:** Create directories that the scheduled task expects to exist.

**Requirements:** R8, R10

**Dependencies:** None

**Files:**
- Create: `C:\Users\stefa\Stefan-Brain\wiki\_log\inbox-signal\.gitkeep`
- Create: `C:\Users\stefa\Stefan-Brain\wiki\_inbox\unresolved-people.md` (with standard header)

**Approach:**
- `wiki/_log/inbox-signal/` — per-agent durable log directory
- `wiki/_inbox/unresolved-people.md` — follows flow1_ingest.py UNRESOLVED_PATH convention; create with Obsidian frontmatter header so it's a proper wiki page from day 1

**Test expectation:** none — scaffolding only. Verify files exist and are committed to Stefan-Brain main.

---

- [ ] **Unit 3: Scheduled task inbox-signal-stanford**

**Goal:** Create the scheduled task that fires at 08:00 daily with a complete self-contained SKILL.md prompt.

**Requirements:** R1–R12

**Dependencies:** Unit 2 (scaffolding must exist when task first fires)

**Files:**
- Create: `C:\Users\stefa\.claude\scheduled-tasks\inbox-signal-stanford\SKILL.md` (via mcp__scheduled-tasks__create_scheduled_task)

**Approach:**
- Task ID: `inbox-signal-stanford`
- Cron: `0 8 * * *`
- Prompt includes: configuration block (allowlist, vocab), Phase 0–6 instructions, output templates, error handling, git commit steps
- Pre-flight exits gracefully on auth failure (logs + stops, no crash)
- Chrome extraction: `javascript_tool` primary, `get_page_text` fallback
- All file paths are absolute Windows paths (Stefan-Brain)

**Test scenarios:**
- Happy path: session authenticated → N messages kept → files written → committed
- Auth failure: `Sign in` detected → diagnostic log entry written → exits
- Zero kept messages: run produces empty source file with `Kept: 0` → still commits log entry
- Unresolved sender: added to unresolved-people.md with context from email thread

**Verification:** `mcp__scheduled-tasks__list_scheduled_tasks` shows `inbox-signal-stanford` with `0 8 * * *` cron.

---

- [ ] **Unit 4: Pre-flight manual run**

**Goal:** Trigger the task once manually and verify end-to-end output.

**Requirements:** R1–R11

**Dependencies:** Unit 3

**Approach:**
- Use Chrome extension tools to attempt `navigate` to `outlook.office.com`
- Verify authentication state
- Confirm Chrome extension is connected; if not, document what Stefan needs to do

**Test scenarios:**
- Chrome extension responds to navigate call → pre-flight passes
- Chrome extension unavailable → document in plan that Stefan must have extension running

**Verification:** Pre-flight check completes without error OR produces a clear diagnostic.

## System-Wide Impact

- **Interaction graph:** Weekly Run Phase 1 can now pick up `wiki/sources/inbox-signal-*.md` files — no changes needed to weekly run to benefit, it reads sources/ naturally
- **Error propagation:** Auth failure exits cleanly; errors in individual message extraction don't abort the whole run (Claude continues with remaining messages)
- **State lifecycle risks:** Idempotent by date — if run twice the same day, second run overwrites (same filename); unresolved-people.md uses append-only pattern so second run adds duplicate entries (acceptable for Phase 1)
- **Unchanged invariants:** Weekly run unmodified; Stefan-Brain wiki/entities/ unmodified; optimus-command-center frontend unmodified

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Chrome extension not running at 8am | Pre-flight detects unavailable MCP tools and logs diagnostic; Stefan can re-run manually |
| Outlook auth session expires | Pre-flight detects "Sign in" text and exits gracefully with log entry |
| Outlook DOM changes break JS extraction | `get_page_text` fallback in prompt; Claude adapts extraction heuristics |
| Duplicate unresolved-people.md entries if run twice | Acceptable Phase 1 limitation; noted in Phase 2 work |
| 90-day Sent Items scrape incomplete (pagination) | Prompt instructs Claude to scroll/paginate; 200-recipient cap is sufficient signal |

## Phase 2 Notes (do NOT build)

Per task spec, documented here only:
1. **Attachment extraction** — PDFs people send; requires opening threads and downloading
2. **Granola cross-reference** — same-person overlap between email senders and meeting attendees
3. **Theme drift tracking** — 90-day topic evolution across email corpus
4. **Dedup for unresolved-people.md** — check existing entries before appending

## Sources & References

- Related code: `scripts/commitment-capture/flow1_ingest.py` (entity matching pattern)
- Related code: `wiki/sources/grant-scan-2026-04-13.md` (source file format)
- knowledge-graph-logger skill: `C:\Users\stefa\.claude\skills\knowledge-graph-logger\`
- Stefan-Brain CLAUDE.md: commit-to-main bulletproof rule
