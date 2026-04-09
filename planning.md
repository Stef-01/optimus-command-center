# Optimus Command Center — Integrated Architecture & Roadmap

## Architecture Overview

Optimus is a 5-layer system, not a simple dashboard:

### Layer 1: Optimus (Human Planning Surface)
- The HTML site + machine-readable manifest (optimus.json)
- Every meaningful task starts here or is promoted here
- Human edits trigger the automation pipeline

### Layer 2: Deterministic Router
- Local scripts watch Optimus changes, compute deltas, create job packets
- Decides whether the task even deserves Claude
- Handles: parsing, diffing, hashing, ranking, rendering, file moves, templating

### Layer 3: Claude Code Session
- Main live environment with repo, filesystem, MCP tools, local context
- Running on Windows machine via terminal or Remote Control
- Reads task packets, decides execution path
- Produces final deliverables and memory updates

### Layer 4: Claude Octopus (Inner Workflow Layer)
- Lives INSIDE the Claude Code session
- Called only for structured workflows, personas, or consensus checks
- 4-phase: Discover → Define → Develop → Deliver
- NOT the top-level scheduler

### Layer 5: Specialized Workers
- Codex for bounded code tasks
- Gemma 4 local (via Unsloth) for cheap preprocessing
- Browser automation for login-gated interactions
- Scripts for deterministic work

## Routing Rules

### Route 1: Deterministic Only
For: parsing, diffing, hashing, ranking, rendering HTML, file moves, templating
No Claude. No Octopus. No Codex.

### Route 2: Gemma Local → Stop
For: compressing notes, clustering, extracting structured fields, deduplicating, cheap tagging
Stop unless output crosses escalation threshold.

### Route 3: Claude Code Alone
For: medium drafting, known-input-to-known-output transforms, first-pass briefs, scoped repo work

### Route 4: Claude Octopus (Claude-only mode)
For: structured research, requirements definition, multi-step planning, specialist personas, phase-gated review

### Route 5: Claude Octopus + Codex
For: architecture decisions, implementation reviews, code quality validation, PR review, security review

### Route 6: Full Octopus Consensus (rare)
For: important new architecture, spec-to-software, adversarial review before shipping public

### Route 7: Codex Direct
For: one component, one test, one refactor, one endpoint. Send back for review after.

## Token-Saving Rules

1. Never pass the whole vault — only task packet + project digest + recent deliverable
2. Compress before escalating — Gemma does triage, classification, extraction first
3. Changed-only orchestration — hash sources, skip unchanged
4. Cache deterministic work — store extracts, summaries, prior outputs
5. Short-lived sessions beat giant immortal chats
6. Write memory after the task, not during every step
7. Use specialized workers — Gemma for cheap structure, Claude for synthesis, Codex for code

## Memory Model (4-Part)

1. **CLAUDE.md** — stable operating rules only (short)
2. **Project digests** — one markdown per project: aim, stage, latest deliverable, open questions, next tasks
3. **Optimus digest** — compiled summary of current focus, priorities, promoted ideas (regenerated from Optimus, not manually maintained)
4. **Decision log** — dated append-only: decisions, rationale, consequences, artifact links

## Data Flow

```
You → Optimus (HTML + JSON manifest)
         ↓
  Optimus watcher / delta parser
         ↓
  Task packet builder
         ↓
  Local queue (jobs/inbox → ready → running → done → archive)
         ↓
  Router (decides tier)
  ├─ Gemma 4 local pre-pass
  ├─ Claude Code run
  ├─ Codex run
  ├─ Deterministic crawlers/fetchers
  └─ Browser escalation
         ↓
  Deliverable factory
         ↓
  outputs/, briefs/, drafts/, decks/, code/
         ↓
  Memory compiler
  ├─ project digest update
  ├─ Optimus digest update
  ├─ decision log entry
  └─ reusable playbooks
         ↓
  Optimus / Obsidian update
```

## Optimus Manifest Schema

The HTML site should also produce optimus.json:

```json
{
  "updated_at": "ISO timestamp",
  "focus": ["current focus areas"],
  "tasks": [{"id", "title", "type", "priority", "status", "project", "due", "notes"}],
  "projects": [{"id", "name", "stage", "desired_outputs"}],
  "ideas": [{"id", "title", "energy", "theme", "next_action"}]
}
```

## Job Queue Structure

```
jobs/
  inbox/    — new job packets from delta parser
  ready/    — validated and prioritized
  running/  — currently being processed
  review/   — needs human check before completion
  done/     — completed with output artifacts
  archive/  — old completed jobs
```

Each job is a JSON file with: id, title, type, priority, route (1-7), inputs, expected_outputs, status, created_at, completed_at.

## Implementation Phases

### V0 (Current)
Static dashboard with hand-authored weekly JSON. 4 tabs: Overview, Life Admin, Ideas, Skills.

### V1: Machine-Readable Manifest
Add optimus.json generation from the existing HTML/JSON data. Create the delta parser script. Set up jobs/ directory structure.

### V2: Airtable Data Foundation
Communications (19 fields) + People (17 fields) + Optimus Config tables. Bootstrap with known NOURISH contacts.

### V3: Source Ingestion Pipeline
- Granola MCP → extract meetings, people, commitments
- Omi MCP → extract voice conversations
- Gmail via Chrome MCP → extract emails (raw text primary, DOM fallback)
- All sources flow through Claude → Airtable

### V4: Relationship Intelligence
- Health scoring (Recency 35%, Frequency 25%, Reciprocity 20%, Depth 20%)
- Priority multipliers by tag (Advisor 2x, Collaborator 1.5x)
- Follow-up gap detection (Paul Oh test case)
- Collaboration matching (Claude-as-judge)

### V5: Auto-Generate Weekly JSON
Replace hand-authored data with pipeline-generated public/weeks/YYYY-MM-DD.json from Airtable data. This is the bridge from V0 frontend to automated backend.

### V6: Local Preprocessing Layer
- Install Gemma 4 via Unsloth on RTX GPU
- Build compression pipeline: raw sources → Gemma extract → compact packets for Claude
- Implement hash-based change detection (skip unchanged sources)

### V7: Job Queue System ✓ BUILT (2026-04-09)
- File-based queue (jobs/inbox → ready → running → done) ✓
- Router script (`scripts/router.js`) applies all 7 routing rules ✓
- Executor (`scripts/executor.js`) dispatches jobs to workers by route ✓
- Codex worker (`scripts/codex-worker.js`) handles Route 5 + Route 7 ✓
- npm scripts: `route`, `execute`, `codex`, `pipeline` ✓
- Job status tracking and audit trail ✓

### V8: Daily Digest & Dashboard
- HTML weekly dashboard with Sous design system
- Daily morning digest via Dispatch
- Weekly dashboard auto-generation every Monday

### V9: AI Stefan — Teammate Pipeline
- Slack DM → classify deliverable → create via skills → upload to Drive → notify
- Teammate Requests Airtable table (17 fields)
- Auto-complete default, 10-min hold for grants

### V10: Octopus Integration
- Install Claude Octopus as plugin in main Claude Code session
- Wire Discover/Define/Develop/Deliver phases to job types
- Build mode (Claude + Codex) for software tasks
- Validation mode for third-angle review

### V11: Full Autonomy
- 4 scheduled tasks: daily ingest (8am), daily digest (8:30am), weekly dashboard (Mon 9am), weekly scoring (Sun 10pm)
- Proactive idea promotion from Optimus backlog
- Self-improving system: weekly skill discovery scan

## Integration Notes

- V5 is the KEY BRIDGE: replaces hand-authored JSON with auto-generated data
- Frontend (index.html) stays unchanged through V1-V5 — only data source changes
- Gemma local (V6) is optional but dramatically reduces token cost
- Octopus (V10) is a power-up, not a prerequisite — system works without it
- The job queue (V7) makes everything composable and debuggable

## What Octopus Should Replace
- Custom hand-written multi-agent prompt recipes
- Ad hoc "ask Claude then ask Codex" loops
- Repetitive phase prompts for research → requirements → implementation → review
- Manual specialist-role prompting

## What Octopus Should NOT Replace
- Optimus as source of truth
- Deterministic scripts for parsing, ranking, rendering
- Gemma local for cheap preprocessing
- Browser capture workers
- Codex direct for small bounded edits
- Site generation and HTML blocks
- Job state and audit trail storage
