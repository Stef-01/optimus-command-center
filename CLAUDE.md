# CLAUDE.md — Optimus Command Center

## What is Optimus
Optimus is Stefan's personal operating system and relationship intelligence dashboard. It aggregates data from Granola (meeting notes), Omi AI (voice conversations), Gmail (emails), Airtable (task registry), and Notion (NOURISH workspace) into a weekly dashboard with proactive intelligence.

## Architecture
- **Frontend:** Pure static site (public/index.html), vanilla JS, dark theme, deployed on Vercel
- **Data:** JSON files per week in public/weeks/YYYY-MM-DD.json
- **Pipeline:** Claude-powered ingestion from multiple sources → structured JSON → frontend renders
- **Intelligence:** Relationship scoring, follow-up gap detection, collaboration matching

## Current State (V0)
- Single monolithic HTML file with 4 tabs: Overview, Life Admin, Ideas, Skills
- Week data is hand-authored JSON — no automation pipeline yet
- Pre-written Claude prompts in Life Admin for task execution
- Skills section identifies automation candidates

## Data Schema
Each week JSON has 4 sections:
- overview: stats, executiveSummary, crossSourceAlignment, priorities, quickWins
- lifeAdmin: personal tasks with claudePrompt field
- ideas: startup/essay/tool concepts with impact/novelty scoring
- skills: automation candidates with scores and pipeline tracking

## Commands
npx serve . — local dev server

## Key Files
- public/index.html — the entire app (HTML + CSS + JS)
- public/weeks/index.json — week manifest
- public/weeks/YYYY-MM-DD.json — weekly data files
- vercel.json — deployment config

## Planning
See planning.md for the full V1-V11 implementation roadmap.
See optimus-planning-v2.md in C:\Users\stefa\Documents\ for the detailed spec.

## Commands (V1+)
- `npm run manifest` — regenerate public/optimus.json from latest week JSON
- `npm run delta` — compute changes since last run, write to jobs/inbox/
- `npm run watch` — run manifest + delta in sequence (use for scheduled tasks)

## Job Queue
- `jobs/inbox/` — new delta files land here
- `jobs/ready/` — jobs approved to run
- `jobs/running/` — in-flight jobs
- `jobs/review/` — completed jobs needing human review
- `jobs/done/` — closed jobs
- `jobs/archive/` — long-term storage
- `.cache/` — previous-manifest.json (not committed, used by delta-parser)

## Tools Integration

**Before starting any Optimus work session, verify these tools are active.**

### 1. claude-mem (session memory)
MUST be running during all Optimus sessions for continuity across runs.
- Start: `npx claude-mem start`
- View: http://localhost:37777
- Purpose: captures what was worked on, decisions made, and context from prior sessions so future runs don't start from scratch.

### 2. QMD (semantic search)
QMD semantic search is configured across stefan-brain, sous, and optimus collections. Use `qmd search` before answering questions about architecture, decisions, or prior work.
- `qmd search "query"` — BM25 keyword search (fast)
- `qmd vsearch "query"` — vector similarity search (semantic, finds conceptually related content)
- `qmd query "query"` — combined BM25 + vector + reranking (best quality, ~2s)
- Collections: `sous`, `stefan-brain`, `optimus` — filter with `-c collection-name`
- Use instead of manually reading week files or index.md when answering questions about past context.

### 3. superpowers plugin
Use for all non-trivial Optimus development work. Follow the structured workflow:
**design → plan → implement → test → review**
- Don't skip the planning phase. `/ce:plan` before writing code.
- Use `/ce:brainstorm` when exploring new Optimus features.

### 4. compound-engineering plugin
- `/ce:brainstorm` — new feature ideas
- `/ce:plan` — implementation planning (required before non-trivial work)
- `/ce:work` — execution
- `/ce:review` — code review
- `/ce:compound` — document learnings after significant changes

### 5. karpathy-llm-wiki skill
Use for ingesting sources into Stefan-Brain. When new Granola/OMI/Gmail data is processed, also ingest summaries into the wiki so the brain stays current.

### 6. Obsidian Stefan-Brain vault
Located at: `C:\Users\stefa\Stefan-Brain`
Every significant Optimus decision, architecture change, or weekly summary should be ingested into the brain. This is the persistent knowledge layer behind Optimus.

## Critical Rules
1. Keep the frontend simple — no framework, no build step. Vanilla HTML/CSS/JS.
2. Data lives in JSON files — the pipeline generates JSON, the frontend renders it.
3. Automation pipeline runs as Claude scheduled tasks, not as backend services.
4. Every week gets its own JSON file — no overwriting, full history preserved.
5. The dashboard must work on mobile (Stefan checks it on his phone).

## Karpathy Coding Principles

Behavioral guidelines to reduce common LLM coding mistakes.

### 1. Think Before Coding
Before implementing: state assumptions explicitly, surface tradeoffs, push back on complexity, stop and ask when unclear. Don't pick silently between interpretations.

### 2. Simplicity First
Minimum code that solves the problem. No features beyond what was asked. No abstractions for single-use code. No speculative flexibility. If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes
Touch only what you must. Don't improve adjacent code, refactor things that aren't broken, or clean up pre-existing dead code. Every changed line should trace directly to the user's request. Remove only imports/variables/functions that YOUR changes made unused.

### 4. Goal-Driven Execution
Transform tasks into verifiable goals. For multi-step tasks, state a brief plan with verify steps. Define success criteria before starting so you can loop independently without constant clarification.
