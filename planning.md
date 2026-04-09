# Optimus Command Center — Planning

## V0 (Current)
Pure static dashboard with hand-authored weekly JSON. 4 tabs: Overview, Life Admin, Ideas, Skills.

## V1: Airtable Data Foundation
Create Communications (19 fields) + People (17 fields) + Optimus Config tables.
See: C:\Users\stefa\Documents\optimus-planning-v2.md section V1 for exact schema.

## V1.5: Bootstrap Seeding
Seed People table with known NOURISH contacts (Paul Oh, Milana Trounce, Drew Endy, etc.)

## V2: Granola Integration
Auto-ingest meeting notes via Granola MCP → extract people, commitments, topics → write to Airtable.

## V3: Omi Integration
Auto-ingest voice conversations via Omi MCP → extract verbal commitments → write to Airtable.

## V4: Gmail Ingestion
Browser-based email scanning via Chrome MCP → extract senders, action items → write to Airtable.

## V5: Relationship Scoring
Compute 0-100 health scores per person. Weighted: Recency 35%, Frequency 25%, Reciprocity 20%, Depth 20%.
Priority multipliers by relationship type (Advisor 2x, Collaborator 1.5x).

## V6: Follow-Up Gap Detection
Flag stale relationships and missed commitments. Paul Oh test case.

## V7: Auto-Generate Weekly JSON
Replace hand-authored JSON with pipeline-generated data from Airtable.
Generate public/weeks/YYYY-MM-DD.json automatically every Monday.

## V8: Collaboration Matching
Claude-as-judge: read person context + publication → suggest NOURISH collaboration.

## V9: Daily Digest
Morning briefing sent to Stefan via Dispatch with top 3-5 action items.

## V10: Full Autonomy
4 scheduled tasks running everything: daily ingest (8am), daily digest (8:30am), weekly dashboard (Mon 9am), weekly scoring (Sun 10pm).

## V11: AI Stefan — Teammate Task Pipeline
Teammates DM on Slack → Claude creates deliverable → uploads to Google Drive → notifies teammate.

## Integration Notes
- V7 is the key bridge: it replaces hand-authored JSON with auto-generated data
- The frontend (index.html) stays unchanged — only the data source changes
- New sections can be added to the JSON schema as pipeline capabilities grow
- The Teammate Requests tab (V11) will need a new section in the JSON and a new tab in index.html
