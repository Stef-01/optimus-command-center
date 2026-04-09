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

## Critical Rules
1. Keep the frontend simple — no framework, no build step. Vanilla HTML/CSS/JS.
2. Data lives in JSON files — the pipeline generates JSON, the frontend renders it.
3. Automation pipeline runs as Claude scheduled tasks, not as backend services.
4. Every week gets its own JSON file — no overwriting, full history preserved.
5. The dashboard must work on mobile (Stefan checks it on his phone).
