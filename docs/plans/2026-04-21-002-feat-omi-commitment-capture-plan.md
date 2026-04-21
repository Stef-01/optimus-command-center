---
title: "feat: OMI Commitment Capture — full pipeline (scheduled task + Airtable + Obsidian + Optimus UI)"
type: feat
status: active
date: 2026-04-21
---

# feat: OMI Commitment Capture

## Overview

Build a complete pipeline that catches every verbal commitment Stefan makes in OMI-recorded
conversations and surfaces them in Optimus. A new `omi-commitment-capture` scheduled agent
fires every 2 hours, pulls OMI transcripts via MCP, runs two-lane extraction (deterministic
regex Lane A + LLM Lane B) over Stefan's spoken segments only, writes each commitment to a new
Airtable `Commitments` table and an Obsidian note, and surfaces the resulting data as a 7th
Commitments tab in Optimus plus overdue commitments prepended to the On Fire banner.

A 14-day backfill runs on first invocation so Stefan launches with a real list.

## Problem Frame

Stefan makes verbal commitments across 10–20 OMI-captured conversations per week. These
disappear unless he remembers to log them manually. The weekly Optimus run currently surfaces
`overview.omi.unactionedCommitments[]` from hand-authored JSON — there is no automated
extraction pipeline. The Skills tab already ranks "OMI Commitment Capture → Airtable" as the
#1 automation candidate (score 95).

The system design at `wiki/sources/ops/commitment-capture-system-design.md` (written
2026-04-13) provides the extraction ruleset, two-lane architecture, and commitment YAML schema.
This plan implements that spec with two departures from its original phasing:
- **Departure 1:** Airtable is day 1, not month 2 — required for Optimus UI integration.
- **Departure 2:** OMI-first (no calendar-event prerequisite) — Flow 2 before Flow 1.
  Calendar-backed meeting pages (Flow 1) are a future addition, not a blocker.

## Requirements Trace

- R1. Scheduled agent fires `0 */2 * * *`, uses Brain-mount preflight guard, dedup lock.
- R2. Pull OMI conversations via OMI MCP using `get_conversation_by_id` for `transcript_segments` (never `structured.overview`).
- R3. Extract commitments from Stefan's spoken segments only (counterparty speech is skipped); use speaker diarization if present, else mark counterparty NEEDS REVIEW.
- R4. Phrase detection covers all 8 categories: strong (`I will/I'll`, `I owe you`, `Leave it with me`, `I'll follow up/get back to/make sure/have X by`), medium (`I'll look into/circle back`, `I can probably`), weak-low-conf (`Maybe I could`, `If I have time`).
- R5. Extracted record carries: verbatim quote + context, counterparty, subject, deadline (ISO), confidence, omi_conversation_id, timestamp_uttered, meeting_context, tags.
- R6. Dual storage: Airtable `Commitments` table (base `appaOQnQ7zrcindYb`) + Obsidian note at `wiki/nourish/_commitments/YYYY-MM/slug.md`.
- R7. Dedup: skip conversation IDs already in `processed-ids.json`; skip record if same counterparty+subject within 24h.
- R8. Quality gate: a conversation with `duration >= 180 min` that yields 0 commitments → write WARN to `wiki/_alerts/YYYY-MM-DD.md`.
- R9. 14-day backfill on first run (detected via absence of processed-ids.json).
- R10. SKILL.md prompt includes ≥3 positive and ≥3 negative extraction examples.
- R11. Weekly JSON adds top-level `commitments: { open, overdue, closed_this_week, counts, overdue_items[], recent_open[] }`. `overdue_items[]` is capped at 3 (for On Fire banner). `recent_open[]` is capped at 5 (for tab card preview). Full record list is NOT serialized into the JSON — tab links to Airtable for the full list.
- R12. New Commitments tab in Optimus (7th tab, coordinate with phone-UX task `local_df668ea1`).
- R13. Overdue commitments surface at the top of On Fire banner (before grant deadlines).
- R14. Tab cards show: counterparty, subject, deadline, confidence badge, status buttons (Delivered/Missed/Extend/Cancel) that write back to Airtable.
- R15. Operations doc at `wiki/sources/ops/omi-commitment-capture.md`. Commit to main + master. Log via knowledge-graph-logger.

## Scope Boundaries

- **Out of scope:** Calendar-backed meeting page creation (Flow 1 from system design spec) — future addition.
- **Out of scope:** Auto-drafted follow-up emails (lying risk, per system design).
- **Out of scope:** Real-time desktop notifications.
- **Out of scope:** Obsidian Dataview daily digest dashboard (system design's "only UI") — this plan builds Optimus tab as the UI instead.
- **Out of scope:** Lane B LLM confidence tuning loop — acceptance threshold of 0.8 ships as default; tuning is a post-launch activity.
- **Out of scope:** Bidirectional Airtable sync (one-way write from agent; future work).

## Context & Research

### Relevant Code and Patterns

- `C:\Users\stefa\.claude\scheduled-tasks\inbox-signal-stanford\SKILL.md` — canonical SKILL.md pattern: preflight → blocked log → extraction → output. Use as template.
- `C:\Users\stefa\.claude\scheduled-tasks\optimus-weekly-run\SKILL.md` — weekly run pipeline phases; needs new commitment-query phase.
- `public/index.html` lines 1429–1435 (desktop tabs) and 1605–1625 (mobile tabs) — add 7th tab here.
- `public/index.html` lines 1937–2006 (`renderOnFireBanner()`) — prepend overdue commitments here before grants loop.
- `public/weeks/2026-04-19.json` — authoritative weekly JSON schema; add `commitments` as new top-level key.
- `scripts/generate-manifest.js` — already classifies OMI-sourced tasks as `type: "verbal-commitment"`.
- `C:\Users\stefa\.claude\optimus-config.json` — read at start of SKILL.md; add new Commitments table ID here post-creation.

### Institutional Learnings

- **OMI MCP tool**: always call `get_conversation_by_id` for `transcript_segments`; summaries are lossy (256% more content in segments). Never use `structured.overview` alone. (`wiki/sources/omi-transcripts/omi-extract-2026-04-13.md`)
- **38% transcript failure rate is normal**: 57 of 149 conversations in April 13 extraction returned empty transcripts from the API. Log failed IDs to `failed-transcripts.log`, do not FATAL.
- **Airtable single-select pitfall**: unrecognized option values fail silently. Pre-create all Status and Confidence option values before bulk-writing records. Call `get_table_schema` to verify before writes. (2026-04-19 log)
- **Date fields**: Airtable requires ISO datetime `YYYY-MM-DDT00:00:00.000Z`; plain `YYYY-MM-DD` fails.
- **Brain-mount guard**: check `[ ! -d "$BRAIN/wiki" ]` — writability check alone does not catch unmounted filesystems. (reliability-architecture.md)
- **Never call git from SKILL.md** — write files only; `git-batch-committer` runs every 15 min.
- **Dedup lock TTL**: use 7200s (matches 2h cron interval) — stale locks from crashes auto-expire.
- **Granola tool name bug analogy**: wrong OMI MCP tool name → silent empty result. Add WARN-on-empty: if conversation list returns 0, log `WARN omi "0 conversations returned — verify MCP tool name"`.
- **Stefan-Brain git branch is `master`**, optimus-command-center is `main`.
- **Two-lane architecture is mandatory**: conflating confirmed and inferred lanes causes trust collapse within weeks. Keep them visually and structurally separate everywhere.

### External References

- `wiki/sources/ops/commitment-capture-system-design.md` — full extraction ruleset, commitment YAML schema, failure mode analysis, phasing rationale. Treat as canonical spec.

## Key Technical Decisions

- **Standalone task, not weekly-run phase**: The 2-hour cadence is incompatible with the Sunday-only weekly run. The Single Orchestrator Rule applies only to weekly synthesis — higher-frequency capture agents are additive. The weekly run will consume Commitments data from Airtable rather than doing extraction itself.

- **OMI-first without calendar gating**: The system design's "calendar is truth of did we meet" principle is correct long-term but not required for initial launch. Meeting context is a best-effort field populated from OMI conversation metadata, not a prerequisite for extraction.

- **Conversation-ID dedup state in `processed-ids.json`**: Persisted at `C:\Users\stefa\Stefan-Brain\wiki\nourish\_commitments\processed-ids.json`. On each run: load IDs, skip processed conversations, append new IDs after successful write. Survives agent restarts and provides the backfill detection signal (missing file = first run).

- **Speaker detection strategy**: Check `transcript_segment.speaker` field (or equivalent OMI schema field). If Stefan's speaker label is identifiable (e.g., `is_user: true`, or `speaker: "speaker_0"` paired with known voice profile), extract only from his segments. If diarization is absent or ambiguous → extract from all segments, set `counterparty: "NEEDS REVIEW"`, flag for manual triage. This is explicitly deferred to implementation after verifying live OMI MCP schema.

- **Airtable `Commitments` as new table** (not reuse of `task_registry`): Commitments have a fundamentally different schema (counterparty, verbatim, confidence, OMI ID, Acknowledged checkbox). Mixing them into task_registry would corrupt the existing schema. New table ID added to optimus-config.json post-creation.

- **Obsidian path `wiki/nourish/_commitments/`** (user-specified, differs from system design's `wiki/commitments/`): The `nourish/` prefix groups it with NOURISH project context, which is where most Stefan commitments originate. The leading `_` prevents Obsidian from indexing it as a navigation page.

- **Tab overflow strategy**: With 6 existing tabs + 1 new Commitments tab = 7 total, mobile tap-target integrity may require "More" overflow if `local_df668ea1` phone-UX task adds additional tabs concurrently. Plan: implement as a full 7th tab initially. If `local_df668ea1` requires overflow, extract both tabs into a `renderMoreMenu()` component. Coordinate before shipping to production.

- **On Fire prepend order**: Overdue commitments rank above grant deadlines in the On Fire banner — a missed commitment to a person is more immediately damaging than a grant deadline 7 days out.

- **FATAL gate is a WARN, not crash**: Writing to `wiki/_alerts/` and logging WARN is the correct behavior for "3+ hour meeting with 0 commitments." A hard crash would prevent the agent from processing subsequent conversations in the same run. The alert surfaces in the morning brief via the existing alerts-to-brief wiring.

- **Confidence mapping**: Lane A regex → `strong` (verbatim phrase match) or `medium` (phrase match without explicit deadline). Lane B LLM → `weak` (surfaced but not phrase-matched). Confidence <0.8 on Lane B → do not write to Airtable/Obsidian, write to inbox instead.

## Open Questions

### Resolved During Planning

- **Should this be a new scheduled task or absorbed into the weekly run?** New standalone task — cadence mismatch (2h vs weekly) and scope mismatch (continuous capture vs synthesis).
- **Which Obsidian path?** `wiki/nourish/_commitments/YYYY-MM/slug.md` per user spec (overrides system design's `wiki/commitments/`).
- **Airtable: new table or reuse task_registry?** New `Commitments` table — schema incompatibility.
- **Should Airtable status buttons in the UI write directly to Airtable?** Yes — same pattern used by task completion flows. Write back via a small inline `fetch` to an Airtable MCP-compatible endpoint or via Claude Code tool invocation. The exact mechanism is deferred to Unit 5 implementation.

### Deferred to Implementation

- **Live OMI MCP tool names**: Implementer must call `mcp__omi__list_tools` (or equivalent) to confirm exact tool names for listing conversations and fetching transcripts. Known from Stefan-Brain CLAUDE.md: `get_conversation_by_id` returns `transcript_segments`. The list/filter call name is unconfirmed.
- **OMI transcript segment speaker field name**: Whether Stefan's voice is labeled `is_user`, `speaker_0`, or another identifier depends on live OMI MCP schema. Inspect a real response before writing speaker-filter logic.
- **Airtable `Commitments` table ID**: Unknown until table is created in Unit 1. Add to `optimus-config.json` after creation.
- **`local_df668ea1` tab count constraints**: Cannot verify without accessing optimus-planning-v2.md or the task definition directly. Implement 7th tab; be prepared to refactor to "More" overflow if the concurrent phone-UX task constrains tab count.
- **Airtable status write-back from UI**: Whether to use a serverless function, a Netlify/Vercel edge function, or a client-side MCP call needs validation against the current deployment setup (pure static Vercel). If no server-side call is possible, status buttons could copy a Claude prompt to clipboard instead — defer to implementation.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Every 2 hours
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ SKILL.md: omi-commitment-capture                                 │
│                                                                  │
│ Phase 0: Preflight                                               │
│   Brain-mount guard → OMI MCP ping → dedup lock (7200s TTL)     │
│                                                                  │
│ Phase 1: Load state                                              │
│   optimus-config.json → processed-ids.json (or BACKFILL)        │
│                                                                  │
│ Phase 2: List OMI conversations                                  │
│   OMI MCP list → filter by since-timestamp or 14d window        │
│   → subtract processed IDs → N new conversations                │
│   WARN if N == 0 (possible wrong tool name)                      │
│                                                                  │
│ Phase 3: Per-conversation loop                                   │
│   get_conversation_by_id → transcript_segments                  │
│   If empty → log failed-ID, continue (38% rate is normal)       │
│                                                                  │
│ Phase 4: Lane A (regex, Stefan-speaker segments only)           │
│   8 pattern categories → confirmed commitments                  │
│                                                                  │
│ Phase 5: Lane B (LLM, non-Lane-A segments)                      │
│   LLM with positive+negative examples → inferred candidates     │
│   confidence ≥ 0.8 → write                                      │
│   confidence < 0.8 → wiki/_inbox/commitments-review-YYYY-MM-DD  │
│                                                                  │
│ Phase 6: Resolve relative deadlines → ISO dates                 │
│   "Friday" + conversation.timestamp → YYYY-MM-DD                │
│                                                                  │
│ Phase 7: Dedup filter                                            │
│   counterparty + subject hash within 24h window → skip          │
│                                                                  │
│ Phase 8: Write commitments                                       │
│   → Airtable Commitments table (create_record)                  │
│   → Obsidian wiki/nourish/_commitments/YYYY-MM/slug.md          │
│   → Update processed-ids.json                                   │
│                                                                  │
│ Phase 9: Quality gate                                            │
│   conversation.duration ≥ 180min AND extracted == 0             │
│   → WARN to wiki/_alerts/YYYY-MM-DD.md                          │
│                                                                  │
│ Phase 10: Release lock + log entry                              │
└─────────────────────────────────────────────────────────────────┘
    │
    ├──► Airtable: Commitments table
    │         (Commitment, Counterparty, Deadline, Status,
    │          Confidence, Verbatim, OMI ID, Tags, Acknowledged)
    │
    └──► Obsidian: wiki/nourish/_commitments/YYYY-MM/slug.md
              (frontmatter mirror of Airtable record)

Weekly Run (separate cadence)
    │
    ▼
  Query Airtable Commitments table
    → count open / overdue / closed_this_week
    → build week JSON { commitments: { open, overdue, closed_this_week, counts } }
    → also feed overview.stats.commitmentsOpen + commitmentsOverdue

Optimus Frontend (reads week JSON)
    │
    ├── On Fire banner: prepend overdue commitments (before grants)
    └── Commitments tab: cards with status write-back buttons
```

## Implementation Units

- [ ] **Unit 1: Airtable Commitments table + config wiring**

**Goal:** Create the `Commitments` table in Airtable base `appaOQnQ7zrcindYb`, define all fields with correct types and option sets, add the new table ID to `optimus-config.json`.

**Requirements:** R6 (Airtable storage), R5 (all record fields present).

**Dependencies:** None — this is the infrastructure prerequisite for all other units.

**Files:**
- Modify: `C:\Users\stefa\.claude\optimus-config.json` (add `tables.commitments: "<new-table-id>"`)

**Approach:**
- Use Airtable MCP `create_table` to create `Commitments` in base `appaOQnQ7zrcindYb`.
- Define fields in this exact order (matches record schema):
  - `Commitment` — Single line text (primary field)
  - `Counterparty` — Single line text
  - `Deadline` — Date field (ISO datetime format required: `YYYY-MM-DDT00:00:00.000Z`)
  - `Status` — Single select: options `Open`, `In-Progress`, `Delivered`, `Missed`, `Cancelled` — pre-create all options
  - `Confidence` — Single select: options `Strong`, `Medium`, `Weak` — pre-create all options
  - `Source` — Single line text (value: `omi-commitment-capture`)
  - `Verbatim` — Long text
  - `OMI ID` — Single line text
  - `Timestamp` — Date field (datetime of utterance)
  - `Context` — Long text (surrounding transcript excerpt)
  - `Tags` — Multiple select (pre-create: `action`, `intro`, `follow-up`, `review`, `send`, `needs-review`)
  - `Acknowledged` — Checkbox (default unchecked)
  - `Lane` — Single select: options `confirmed`, `inferred`
  - `Direction` — Single select: options `outbound`, `inbound`
- After creation, call `get_table_schema` to capture the returned table ID.
- Write the table ID into `optimus-config.json` under `airtable.tables.commitments`.

**Patterns to follow:**
- Airtable MCP field creation pattern from 2026-04-19 log (`create_field` for adding fields to existing tables; `create_table` for new).
- Always pre-create all single-select options before writing any records.

**Test scenarios:**
- Happy path: table created with all 14 fields, `get_table_schema` returns expected field names and types.
- Edge case: if `create_table` returns table ID immediately, do not call `get_table_schema` separately — use returned ID directly.
- Error path: if any field `create_field` call fails, log the field name and continue — partial schema is better than no table; fix missing fields manually before first run.

**Verification:**
- `optimus-config.json` contains `airtable.tables.commitments` with a valid Airtable table ID (format: `tbl…`).
- Opening the Airtable base in browser shows `Commitments` table with all 14 fields.
- A test record created via MCP with a `Status: "Open"` value succeeds without error.

---

- [ ] **Unit 2: Obsidian scaffold — directory structure + index note**

**Goal:** Create the `wiki/nourish/_commitments/` directory tree and an `index.md` that serves as the persistent state file (stores `last_processed_timestamp` in frontmatter) and as a human-readable index of commitment notes.

**Requirements:** R6 (Obsidian storage), R9 (backfill detection via index absence).

**Dependencies:** None — can run in parallel with Unit 1.

**Files:**
- Create: `wiki/nourish/_commitments/index.md` (Obsidian vault path)
- Create: `wiki/nourish/_commitments/processed-ids.json` (empty array `[]` — populated by SKILL.md on first run)

**Approach:**
- The `index.md` frontmatter carries `last_processed_timestamp: null` on initial creation. The SKILL.md updates this after each run. Absence of this file triggers backfill mode.
- The `processed-ids.json` file is a flat JSON array of OMI conversation IDs already processed. Using JSON (not a markdown file) allows the SKILL.md to read/update it with a simple bash read/write without parsing markdown.
- Monthly subdirectories (`2026-04/`, `2026-05/`, etc.) are created on demand by the SKILL.md when the first commitment for a month is written.

**Patterns to follow:**
- Frontmatter schema from `optimus-config.json` `frontmatter_schema` (required fields: `title`, `type`, `tags`, `created`).
- Directory-level README pattern from `wiki/sources/omi-transcripts/`.

**Test scenarios:**
- Happy path: index.md readable by Obsidian, frontmatter valid, `processed-ids.json` is valid JSON array `[]`.
- Edge case: SKILL.md must handle case where `processed-ids.json` exists but contains invalid JSON (corruption recovery) — treat as empty array, log WARN.

**Verification:**
- Obsidian vault shows `nourish/_commitments/index.md` with valid frontmatter.
- `processed-ids.json` parses as `[]` with no errors.

---

- [ ] **Unit 3: SKILL.md — `omi-commitment-capture` scheduled agent**

**Goal:** The core scheduled agent. Implements all 10 execution phases: preflight, state load, OMI conversation list, per-conversation transcript fetch, Lane A regex extraction, Lane B LLM extraction, deadline resolution, dedup filter, dual-storage write, quality gate, state save + lock release + log.

**Requirements:** R1–R10 (all pipeline requirements).

**Dependencies:** Unit 1 (Airtable table must exist and have ID in config), Unit 2 (index.md and processed-ids.json must exist).

**Files:**
- Create: `C:\Users\stefa\.claude\scheduled-tasks\omi-commitment-capture\SKILL.md`
- Create (via `mcp__scheduled-tasks__create_scheduled_task`): scheduled task registered with cron `0 */2 * * *`

**Approach — phase-by-phase:**

*Phase 0: Preflight*
- Brain-mount guard: `[ ! -d "$BRAIN/wiki" ]` → write blocked entry to `wiki/_alerts/YYYY-MM-DD.md`, exit 0 (not exit 1 — don't trigger cron failure alerts for infrastructure issues).
- OMI MCP availability: attempt a list call. If MCP tool unavailable → write blocked log, exit 0. If returns 0 conversations → log `WARN: 0 conversations returned — verify OMI MCP tool name`, continue (do not exit — may be genuinely empty window).
- Dedup lock: check `C:\Users\stefa\.claude\locks\omi-commitment-capture.lock`. If exists AND age < 7200s → exit 0 silently. If age ≥ 7200s → WARN stale lock, delete and continue. Create new lock file with current timestamp.

*Phase 1: Load config + state*
- Read `optimus-config.json` for all paths and IDs. Never hardcode.
- Read `processed-ids.json`. If missing → set `BACKFILL_MODE=true`, window = last 14 days. If present → window = since `last_processed_timestamp`.

*Phase 2: List conversations + dedup filter*
- Call OMI MCP list (verify exact tool name in implementation). Filter by time window.
- Subtract IDs already in `processed-ids.json` → `new_conversations[]`.
- If `new_conversations` is empty → log "no new conversations in window", release lock, exit 0.

*Phase 3: Per-conversation transcript fetch*
- For each conversation: call `get_conversation_by_id` → `transcript_segments`.
- If `transcript_segments` empty → log `SKIP: conversation_id <id> returned empty transcript (38% normal rate)`, add ID to `failed-transcripts-YYYY-MM-DD.log`, continue to next conversation. Do NOT FATAL.

*Phase 4: Speaker detection*
- Inspect first few segments of `transcript_segments` for speaker field (`is_user`, `speaker`, `speaker_label` — verify exact field name in implementation).
- If Stefan's speaker identifiable → filter `stefan_segments = segments.filter(s => s.is_user === true)` (or equivalent).
- If speaker field absent or ambiguous → use all segments, set `speaker_unknown = true` for all commitments from this conversation (maps to `counterparty: "NEEDS REVIEW"` in the record).

*Phase 5: Lane A regex extraction (stefan_segments only)*
- Run all 8 regex patterns from `commitment-capture-system-design.md` against Stefan's segments.
- For each match: extract verbatim quote (full sentence containing match), surrounding context (2 sentences before/after), classify direction (outbound/inbound), classify confidence (strong if explicit deadline present, medium otherwise).
- Resolve counterparty from conversation metadata (attendees list, participant name from OMI conversation object — verify field in implementation).

*Phase 6: Lane B LLM extraction (non-Lane-A segments of stefan_segments)*
- Run LLM prompt over segments not already matched by Lane A.
- Prompt must include ≥3 positive examples and ≥3 negative examples (see Patterns section below).
- Parse LLM response as JSON array of candidate objects with `confidence` float.
- Route: confidence ≥ 0.8 → add to write queue with `lane: inferred`. Confidence < 0.8 → write to `wiki/_inbox/commitments-review-YYYY-MM-DD.md` for manual triage. Never auto-promote.

*Phase 7: Deadline resolution*
- For each commitment with a deadline mention ("Friday", "next week", "by tomorrow", "by 4/28"):
  - Resolve against `conversation.created_at` timestamp as the reference date.
  - Map to ISO `YYYY-MM-DD`. Examples: "Friday" → next Friday from conversation date; "next week" → following Monday; "tonight" → same day; "by 4/28" → `2026-04-28`.
  - If unresolvable → set `deadline: null`, add `needs-review` tag.

*Phase 8: Dedup filter (record-level)*
- Hash each pending commitment by `counterparty + subject`.
- Query Airtable Commitments table for records with matching counterparty+subject created in past 24h.
- If duplicate exists → skip, log `DEDUP: skipped duplicate <subject> for <counterparty>`.

*Phase 9: Dual-storage write*
- **Airtable write** (per commitment):
  - `create_record` in Commitments table.
  - `Status` field value: always `"Open"` for new records.
  - `Deadline` field value: `YYYY-MM-DDT00:00:00.000Z` format (not plain date string).
  - If `create_record` fails → log error with commitment details, continue (do not abort run).
- **Obsidian write** (per commitment):
  - Path: `wiki/nourish/_commitments/YYYY-MM/<counterparty-slug>-<subject-slug>-<cmt-id>.md`
  - Frontmatter mirrors all Airtable fields plus `airtable_id` (returned record ID from create_record).
  - Use Obsidian MCP `write_note` or bash write — do NOT call git.
  - If write fails → log error, continue.

*Phase 10: Quality gate*
- For each conversation where `conversation.duration >= 180` (minutes) AND no commitments were written (neither Airtable nor inbox):
  - Write WARN to `wiki/_alerts/YYYY-MM-DD.md`: `[omi-commitment-capture WARN] <conversation_id> ran 3h+ with 0 extracted commitments`.
  - Continue — do not abort. The alert surfaces in morning brief.

*Phase 11: State save*
- Append all successfully processed conversation IDs to `processed-ids.json`.
- For empty-transcript (failed) conversations: track retry count in a companion `failed-transcript-retries.json` (format: `{ "<conversation_id>": N }`). After 3 failed attempts, add the ID to `processed-ids.json` and remove it from the retry tracker — this stops perpetual re-fetching of conversations the OMI API will never return transcripts for.
- Prune `processed-ids.json` entries older than 30 days (based on associated timestamp stored alongside each ID as `{ "id": "...", "processed_at": "..." }` objects) to prevent unbounded growth.
- Update `index.md` frontmatter field `last_processed_timestamp` to current ISO timestamp.

*Phase 12: Release lock + log*
- Delete `C:\Users\stefa\.claude\locks\omi-commitment-capture.lock`.
- Write log entry to `wiki/_log/YYYY-MM-DD.md` with outcome (N conversations processed, M commitments written, K inbox, J failed-transcript).
- Do NOT call git — git-batch-committer handles this every 15 min.

**SKILL.md LLM extraction prompt examples (required per R10):**

Positive examples (should extract):
1. "I'll send you the grant template by Friday" → outbound send, strong
2. "Let me get back to you on the budget numbers by end of week" → outbound follow-up, strong  
3. "I owe you an intro to Gardner — I'll do that this week" → outbound intro, strong

Negative examples (should NOT extract):
1. "You said you'd get back to me" — counterparty commitment, not Stefan's
2. "Maybe if there's time we could explore that" — speculative, no commitment
3. "I was thinking we might look into that someday" — vague future, no deliverable

**Patterns to follow:**
- Preflight structure: `inbox-signal-stanford\SKILL.md` Phase 0 (Brain-mount + MCP check + blocked log pattern).
- Lock file pattern: `reliability-architecture.md` Layer 5 dedup lock.
- Log entry format: `knowledge-graph-logger` SKILL.md format (Channel: Scheduled).
- Obsidian frontmatter: required fields `title`, `type`, `tags`, `created` from `optimus-config.json`.

**Test scenarios:**
- Happy path: 3 new conversations processed, 2 commitments extracted (1 Lane A, 1 Lane B ≥0.8), written to Airtable + Obsidian, processed-ids updated, lock released.
- Edge case — empty transcript: conversation returns 0 segments → ID logged to failed-transcripts, not to processed-ids (so it is retried next run), run continues.
- Edge case — no new conversations: list returns only already-processed IDs → log "no new conversations", exit cleanly, no writes.
- Edge case — stale lock (age > 7200s): WARN logged, old lock deleted, new lock created, run proceeds.
- Edge case — first run (no processed-ids.json): BACKFILL_MODE active, 14-day window, processed-ids.json created at end.
- Edge case — relative deadline resolution: "by Friday" in a conversation timestamped 2026-04-21 (Tuesday) → `2026-04-24T00:00:00.000Z`.
- Error path — Airtable write fails: log error with verbatim quote, continue to next commitment, do not abort run.
- Error path — Brain not mounted: write blocked alert to local log if accessible, exit 0 immediately.
- Error path — OMI MCP unavailable: write blocked alert, exit 0.
- Quality gate: conversation with `duration: 200` (minutes) and 0 commitments → WARN in `wiki/_alerts/`, run continues.
- Lane B routing: LLM returns candidate with `confidence: 0.6` → written to inbox, NOT to Airtable/Obsidian.
- Dedup: second commitment for same counterparty+subject within 24h → skipped with log entry.

**Verification:**
- Scheduled task visible in `mcp__scheduled-tasks__list_scheduled_tasks` with correct cron.
- `C:\Users\stefa\.claude\scheduled-tasks\omi-commitment-capture\SKILL.md` exists.
- Manual trigger of SKILL.md (simulate run) produces: at least 1 Airtable record in Commitments table, at least 1 Obsidian note in `wiki/nourish/_commitments/`, `processed-ids.json` has ≥1 entry, log entry in `wiki/_log/YYYY-MM-DD.md`.

---

- [ ] **Unit 4: Weekly JSON `commitments` block + weekly run update**

**Goal:** Add the `commitments` schema to the weekly JSON (documented + applied to current week template) and add a new phase to the optimus-weekly-run SKILL.md that queries the Airtable Commitments table and builds the `commitments` JSON block.

**Requirements:** R11 (weekly JSON `commitments` key).

**Dependencies:** Unit 1 (Commitments table must exist with known ID in config).

**Files:**
- Modify: `C:\Users\stefa\.claude\scheduled-tasks\optimus-weekly-run\SKILL.md` (add Phase 1.5: Commitment sync)
- Modify: `docs/weekly-run-architecture.md` (document new phase and schema)
- Modify: `public/weeks/2026-04-19.json` (add empty `commitments` block as schema seed)

**Approach:**
- Add Phase 1.5 to the weekly run SKILL.md between Phase 1 (Ingest) and Phase 2 (Brain Update):
  ```
  Phase 1.5: Commitment counts + preview (Airtable Commitments table)
  1. Read Airtable Commitments table (tables.commitments from config)
  2. Count records: open = Status=="Open", overdue = Status=="Open" AND Deadline < today,
     closed_this_week = (Status=="Delivered" OR "Missed" OR "Cancelled") AND updated this week
  3. Fetch top 3 overdue records (sorted by Deadline ASC) → overdue_items[]
     Each: { id, counterparty, subject, deadline_label (e.g. "3 days overdue") }
  4. Fetch top 5 most recent open records (sorted by created DESC) → recent_open[]
     Each: { id, counterparty, subject, deadline, confidence, lane }
  5. Build week JSON block:
     { "commitments": {
         "open": N, "overdue": N, "closed_this_week": N,
         "counts": { "strong": N, "medium": N, "weak": N },
         "overdue_items": [...],   // capped at 3, for On Fire banner
         "recent_open": [...]      // capped at 5, for tab card preview
       }
     }
  6. Also populate overview.stats.commitmentsOpen and commitmentsOverdue
  NOTE: Do NOT serialize all records into the JSON. The tab shows preview cards
  from recent_open[] and links to Airtable for the full list.
  ```
- Add `"commitmentsOpen": 0, "commitmentsOverdue": 0` to `overview.stats` in `2026-04-19.json` as schema seed (value 0, not null, so the frontend doesn't need null-guards).

**Patterns to follow:**
- Existing Phase 1 Airtable query in weekly run SKILL.md.
- `overview.stats` pattern from `2026-04-19.json` — all stats are integers.

**Test scenarios:**
- Happy path: weekly run queries Commitments table, gets N records, writes correct counts to week JSON.
- Edge case: Commitments table empty (no records yet) → all counts are 0, not null.
- Edge case: `tables.commitments` not yet in config (unit shipped before Unit 1) → skip Phase 1.5 with log note, do not fail weekly run.

**Verification:**
- `2026-04-19.json` (or the next week's JSON) contains `"commitments": { "open": 0, "overdue": 0, "closed_this_week": 0, "counts": {...} }`.
- Weekly run SKILL.md Phase 1.5 section is present and correctly references `tables.commitments` from config.

---

- [ ] **Unit 5: Optimus frontend — Commitments tab + On Fire integration**

**Goal:** Add the 7th Commitments tab to the Optimus dashboard with card rendering, status write-back buttons, and prepend overdue commitments to the On Fire banner before the grants loop.

**Requirements:** R12–R14 (tab, On Fire, card interactions).

**Dependencies:** Unit 4 (weekly JSON must have `commitments` key for On Fire count).

**Files:**
- Modify: `public/index.html`

**Approach:**

*Desktop tab button (line ~1435 in current file):*
```html
<button class="section-tab" data-section="commitments">🤝 Commitments</button>
```

*Mobile tab button (line ~1625):*
```html
<button class="mobile-tab-item" data-section="commitments" aria-label="Commitments">
  <span class="mobile-tab-icon">🤝</span>
  <span class="mobile-tab-label">Commitments</span>
</button>
```

*Section content div:* Add `<div id="commitments" class="section-content">` container. Wire to `renderCommitments()`.

*`renderCommitments()` function:*
- Reads `this.currentWeek.commitments` for counts and preview data.
- **Card data source: `this.currentWeek.commitments.recent_open[]` (capped at 5) and `overdue_items[]` (capped at 3).** NOT a full records array — the weekly JSON carries only a preview. A "View all in Airtable →" link at the bottom of the tab opens the full Commitments table.
- Cards show: counterparty name, subject (Commitment field), deadline (formatted as "due in N days" or "N days overdue"), confidence badge (color-coded: strong=green, medium=yellow, weak=gray), lane badge (confirmed/inferred), status badge.
- Status action buttons: `Delivered` (green), `Missed` (red), `Extend` (yellow), `Cancel` (gray). Each button calls `updateCommitmentStatus(recordId, status)`.
- `updateCommitmentStatus(recordId, status)`: Because Optimus is a pure static site (no server), the status buttons copy a pre-formatted Claude prompt to clipboard that updates the Airtable record — same pattern as Life Admin `claudePrompt`. A direct Airtable API call is not possible from static Vercel without a backend. Implement as clipboard-copy with tooltip "Copied — paste into Claude to update".
- Section layout: "🔥 Overdue" section (from `overdue_items[]`) at top, then "📋 Recent open" section (from `recent_open[]`), then stats row (open count, closed this week), then "View all →" Airtable link.

*On Fire prepend (in `renderOnFireBanner()` around line 1940):*
- Before the grants loop, add a new block:
  ```javascript
  // Overdue commitments — prepend before grants
  const overdueCommitments = (week.commitments?.overdue_items || []);
  overdueCommitments.forEach(c => {
    items.push({
      id: `commitment:${c.id}`,
      icon: '🤝',
      text: `${c.counterparty} — ${c.subject} (due ${c.deadline_label})`
    });
  });
  ```
- This requires the weekly JSON `commitments` block to include an `overdue_items[]` array with `{id, counterparty, subject, deadline_label}` objects for the top 3 overdue items (not all — cap at 3 to avoid bloating On Fire).
- Update Unit 4 weekly run phase to also populate `commitments.overdue_items[]`.

*Tab overflow coordination:*
- Add a `// TODO: coordinate with local_df668ea1 phone-UX task re: tab overflow` comment above the tab buttons. If that task requires a "More" menu, both tabs can be moved there.

**Patterns to follow:**
- `claudePrompt` clipboard copy pattern from Life Admin tab (lines ~2060–2090 in index.html).
- `renderOnFireBanner()` items array pattern (lines 1940–1968).
- Mobile tab structure (lines 1605–1625): each `mobile-tab-item` needs `mobile-tab-icon` + `mobile-tab-label` children.
- Dual-path null-safe JSON access: `week.commitments?.open ?? 0` (never direct property access that crashes on missing key).

**Test scenarios:**
- Happy path: week JSON has `commitments: { open: 3, overdue: 1, overdue_items: [{id, counterparty, subject, deadline_label}], recent_open: [{...}×5] }` → tab renders overdue section + recent open cards, On Fire banner shows 1 commitment item at top.
- Edge case: `commitments` key absent from week JSON → tab shows "No commitments data for this week" empty state, On Fire unaffected.
- Edge case: `overdue_items` empty array → no commitment items in On Fire banner, grants loop runs as before.
- Edge case: 7 tabs on mobile → verify tap targets ≥44px; if overflow needed, extract to "More" menu.
- Status button click: `updateCommitmentStatus()` copies correct Claude prompt to clipboard without error.
- Error path: malformed commitment record (missing counterparty) → card renders with "Unknown" fallback, no crash.

**Verification:**
- Loading the dashboard with a week JSON that includes a `commitments` block shows the Commitments tab.
- Tab navigation works on both desktop and mobile.
- An overdue commitment item appears at the top of the On Fire banner.
- Clicking a status button copies text to clipboard (verify with browser devtools `clipboard` event).
- All 6 existing tabs continue to render without regression.

---

- [ ] **Unit 6: Documentation + first-run backfill verification**

**Goal:** Write the operations doc, trigger the first backfill run, verify end-to-end: ≥1 real commitment lands in Airtable + Obsidian + appears in Optimus UI. Commit everything to correct branches.

**Requirements:** R15 (ops doc, commits, log entry).

**Dependencies:** Units 1–5 all complete.

**Files:**
- Create: `wiki/sources/ops/omi-commitment-capture.md` (Obsidian path)
- No new code files — this unit is verification + documentation.

**Approach:**

*Operations doc (`wiki/sources/ops/omi-commitment-capture.md`) must cover:*
- What it does (one paragraph)
- Cron schedule and lock location
- Airtable table ID and field reference
- Obsidian path pattern
- How to tune the extraction (where regex lives in SKILL.md, how to add phrases)
- How to handle stuck locks (manual delete path)
- What WARN alerts look like and where they surface
- Known limitations (38% transcript failure rate, speaker diarization gaps, static-site write-back workaround)
- Backfill instructions (delete processed-ids.json and re-trigger to reset)

*First-run backfill trigger:*
- Confirm `processed-ids.json` does not exist (or delete it to force backfill).
- Manually trigger the scheduled task via `mcp__scheduled-tasks__` or by running the SKILL.md directly.
- Observe that last 14 days of OMI conversations are processed.
- Confirm in Airtable: ≥1 record in Commitments table with `Status: "Open"`.
- Confirm in Obsidian: ≥1 note exists under `wiki/nourish/_commitments/`.
- Confirm in Optimus UI: load current week, check Commitments tab renders without crash.
- If backfill produces 0 commitments → investigate: check OMI MCP tool names, check transcript_segments field, check regex patterns against sample transcript.

*Commits:*
- Optimus repo: `git add -A && git commit -m "feat: omi-commitment-capture — full pipeline" && git push origin main`
- Stefan-Brain: `cd /c/Users/stefa/Stefan-Brain && rm -f .git/index.lock && git add -A && git commit -m "omi-commitment-capture: scaffold, ops doc, first backfill" && git push origin master`

*Log entry:*
- Invoke `knowledge-graph-logger` skill with session summary.

**Patterns to follow:**
- Ops doc style: `wiki/sources/ops/reliability-architecture.md` and `wiki/sources/ops/commitment-capture-system-design.md`.
- Commit messages from existing agents: `<task-slug> YYYY-MM-DD — description`.

**Test scenarios:**
- Happy path: backfill finds ≥5 conversations from last 14 days, extracts ≥1 commitment, all three storage targets populated.
- Edge case: backfill finds conversations but all transcripts are empty → log entries in `failed-transcripts-YYYY-MM-DD.log`, no commitments written, processed-ids.json still updated with processed (empty) conversation IDs.
- Verification failure — 0 commitments from backfill: This is a signal to investigate OMI MCP tool names or regex patterns. Document the debug path in the ops doc.

**Verification:**
- `wiki/sources/ops/omi-commitment-capture.md` exists with all required sections.
- At least 1 Airtable record in Commitments table.
- At least 1 Obsidian note in `wiki/nourish/_commitments/`.
- Optimus dashboard loads, Commitments tab renders.
- Both git repos committed and pushed.
- Log entry written for this session.

## System-Wide Impact

- **Interaction graph:** The `omi-commitment-capture` agent writes to Airtable and Obsidian independently of all other agents. The `optimus-weekly-run` reads from the Commitments table in its new Phase 1.5. The `morning-brief` agent already wires `wiki/_alerts/` into its output — WARN entries from quality gate will surface automatically. The `git-batch-committer` picks up all Obsidian writes within 15 minutes.

- **Error propagation:** Agent failures are self-contained. A crashed omi-commitment-capture run releases its lock after 7200s (stale lock TTL), does not affect weekly run, does not affect morning brief (unless it wrote a WARN alert). Airtable/Obsidian write failures are logged and skipped per commitment — the run continues.

- **State lifecycle risks:** `processed-ids.json` is the most fragile state file. If it grows unbounded (hundreds of thousands of entries), JSON parse time will degrade. Mitigation: only store IDs from the past 30 days (prune entries older than 30 days on each run). If it gets corrupted → delete and rerun (backfill is idempotent thanks to record-level dedup against Airtable).

- **API surface parity:** The Commitments tab uses clipboard-copy for status write-back (same pattern as Life Admin claudePrompt). If a future version adds a backend/edge function for direct Airtable writes, this pattern can be upgraded without changing the card rendering.

- **Integration coverage:** The end-to-end path (OMI MCP → extraction → Airtable → weekly JSON → On Fire banner) spans 4 systems. Unit tests alone will not prove this works. The backfill verification in Unit 6 is the integration test.

- **Unchanged invariants:** All 6 existing tabs continue to render from their existing JSON keys. The On Fire banner's existing grants and Life Admin urgency logic is unchanged — overdue commitments are prepended, not replacing existing logic. The weekly run Phases 1–6 are unchanged — Phase 1.5 is additive.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| OMI MCP tool names unknown until runtime | Implementer must verify live names before writing extraction section; add WARN-on-empty guard |
| Speaker diarization absent in OMI transcripts | Fallback to all-segments extraction + NEEDS REVIEW tag; acceptable quality loss |
| 38% transcript failure rate creates sparse extraction | Normal rate, not a bug; log failed IDs, do not FATAL |
| Airtable single-select validation failures on first write | Pre-create all Status+Confidence options in Unit 1; call `get_table_schema` before writes |
| `local_df668ea1` phone-UX task adds tab count constraints | Add `TODO` comment; design tab to be moveable to "More" overflow without refactoring card logic |
| Static site cannot make direct Airtable API calls for write-back | Clipboard-copy pattern for status buttons; acceptable UX for V1 |
| `processed-ids.json` unbounded growth over time | Prune entries older than 30 days on each run (implementer decision — not blocking launch) |
| Relative deadline resolution errors (timezone, ambiguous "next week") | Use conversation timestamp timezone; for ambiguous cases set `deadline: null` + `needs-review` tag rather than wrong date |
| Lane B LLM hallucination | Hard gate: confidence < 0.8 → inbox only, never auto-write; two-lane architecture prevents hallucinations reaching confirmed records |

## Documentation / Operational Notes

- The ops doc (`wiki/sources/ops/omi-commitment-capture.md`) is a required deliverable — it is the runbook for future maintenance.
- If the WARN alert fires for a 3-hour meeting with 0 commitments, the first debug step is to manually call `get_conversation_by_id` for that conversation ID and inspect the raw `transcript_segments` response.
- The `processed-ids.json` file doubles as the "last processed" timestamp index. If Stefan wants to re-extract a specific conversation (e.g., the regex was wrong), remove its ID from the array and re-trigger.
- The Airtable `Acknowledged` checkbox field is for Stefan to mark commitments he has reviewed in the Airtable UI. It is not written by the agent (only by Stefan) and is not read by the Optimus frontend.
- Tune extraction by editing the regex table in the SKILL.md `Phase 5` section and the positive/negative examples in the `Phase 6` LLM prompt.

## Sources & References

- **Origin spec:** `wiki/sources/ops/commitment-capture-system-design.md`
- Reliability architecture: `wiki/sources/ops/reliability-architecture.md`
- OMI extraction patterns: `wiki/sources/omi-transcripts/omi-extract-2026-04-13.md`
- Scheduled task template: `C:\Users\stefa\.claude\scheduled-tasks\inbox-signal-stanford\SKILL.md`
- Airtable field-type gotchas: `wiki/_log/2026-04-19.md`
- Frontend tab pattern: `public/index.html` lines 1429–1435, 1605–1625
- On Fire banner logic: `public/index.html` lines 1932–2006
- Config authority: `C:\Users\stefa\.claude\optimus-config.json`
