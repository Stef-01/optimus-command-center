---
title: "fix: Optimus 5-issue quality & reliability pass"
type: fix
status: active
date: 2026-04-21
---

# fix: Optimus 5-issue quality & reliability pass

## Overview

Five distinct defects degrade the Optimus dashboard: two are data-wiring bugs (Granola indicator, OMI indicator), one is a content volume/quality gap (Bumblebee), one is a missing count target (Skills), and one is a near-zero generation failure (Tinker). All five are fixed in a single pass across `public/index.html`, `public/weeks/2026-04-19.json`, and the optimus-weekly-run `SKILL.md`.

## Problem Frame

**Diagnosis per issue:**

1. **Granola red X** — `overview.granola` sub-object is never populated by optimus-weekly-run. The HTML badge logic reads `ov.granola` (always null) for presence detection. The meeting count exists at `ov.stats.granola` but is ignored by the badge. Fix requires both an HTML fallback and a SKILL.md schema addition.

2. **OMI "zero conversations"** — When OMI MCP is unavailable (code sessions, not Cowork), optimus-weekly-run populates `overview.omi` as an object with all-null counts. The badge checks `!!(ov.omi)` — truthy because the object exists — so it shows green with "0 convs · 0 memories". Fix: check `ov.omi?.conversations > 0` (or stats fallback) for `ok`; badge goes red when OMI is genuinely absent.

3. **Bumblebee too sparse/generic** — SKILL.md Tab 4 specifies "10+ ideas." Current JSON has 10 ideas, none with the cross-domain surprise that made earlier Bumblebee output compelling. Fix: raise to 20+ ideas and restore the creative brief anchored in Stefan's domains (pharmacogenomics × cooking, oculomics × everyday wellness, biosecurity × consumer apps, AI × culture).

4. **Skills section too sparse** — Phase 8 has no count target. Current JSON has 7 skills. Fix: add explicit target of 14+ skills.

5. **Tinker near-zero** — Phase 10 says "8-12 fresh tinker ideas" but 2026-04-13 had only 1. The mandate is weak and quality bar is vague. Fix: raise to 20 ideas, add IDEO-level quality bar, add Phase 3.5 assertion for `tinker.ideas.length >= 15` (FATAL if zero).

## Requirements Trace

- R1. Granola badge shows green with meaningful tooltip when Granola data is present
- R2. OMI badge shows red (not misleadingly green) when OMI MCP was not called or returned empty
- R3. Bumblebee tab shows 20+ cross-domain, high-novelty ideas anchored in Stefan's actual domains
- R4. Skills tab shows 14+ automation candidates
- R5. Tinker tab shows 20 IDEO-level weekend-buildable ideas; Phase 3.5 assertion makes zero-count a FATAL failure

## Scope Boundaries

- No new tabs or UI structure changes
- No changes to authentication or MCP tool definitions
- SKILL.md changes apply to future runs; 2026-04-19.json is patched manually for the current week

## Implementation Units

- [ ] **Unit 1: Fix HTML Granola indicator**

**Goal:** Badge shows green when `stats.granola > 0` even if `overview.granola` sub-object is missing

**Files:**
- Modify: `public/index.html`

**Approach:**
- In `renderSourceHealthBadges`, change: `const granolaData = ov.granola || null` to fall back to a synthetic object when stats.granola > 0: `const granolaData = ov.granola || (stats.granola > 0 ? { meetingsReviewed: stats.granola, keyDecisions: null } : null)`
- Tooltip: if `keyDecisions` is null, show only meetings count

**Test scenarios:**
- Happy path: `ov.granola = { meetingsReviewed: 4, keyDecisions: 8 }` → green badge, "4 meetings · 8 decisions"
- Fallback: `ov.granola = null`, `stats.granola = 4` → green badge, "4 meetings"
- Absent: `ov.granola = null`, `stats.granola = 0` or null → red badge, "No Granola data"

**Verification:** Load 2026-04-19.json in browser → Granola badge is green

- [ ] **Unit 2: Fix HTML OMI indicator**

**Goal:** Badge is red when OMI data is absent/empty, not misleadingly green

**Files:**
- Modify: `public/index.html`

**Approach:**
- Change `omiPresent` logic: instead of `ov.omi || (stats.omiWords != null && stats.omiWords > 0)`, use `(ov.omi?.conversations > 0) || (stats.omiConversations > 0) || (stats.omiWords > 0)`
- This makes the `ok` field false when omi object exists but all counts are null

**Test scenarios:**
- Happy path: `ov.omi.conversations = 12` → green badge, "12 convs · N memories"
- Empty object: `ov.omi = { conversations: null, ... }` → red badge, "No OMI data this week"
- Stats fallback: `stats.omiConversations = 5` → green badge

**Verification:** 2026-04-19.json with null OMI → OMI badge is red

- [ ] **Unit 3: Fix SKILL.md — generator quality and count targets**

**Goal:** Future runs produce 20 Bumblebee, 14+ Skills, 20 Tinker; Phase 3.5 asserts Tinker length; OMI emit WARN not silent pass; Granola sub-object schema defined

**Files:**
- Modify: `C:\Users\stefa\Documents\Claude\Scheduled\optimus-weekly-run\SKILL.md`

**Approach:**
- Tab 4 (Bumblebee): change "10+ ideas" to "20+ ideas"; add creative brief: "Cross-domain, contrarian, slightly absurd with a thread of viability — NOT safe extrapolations. Anchor in Stefan's domains: pharmacogenomics × cooking, biosecurity × consumer apps, oculomics × everyday wellness, AI × culture. Each idea should feel like it came from the intersection of two things that have no right to meet."
- Phase 8 (Skills): add "Generate 14+ skill automation candidates"
- Phase 10 (Tinker): change "8-12" to "20 fresh tinker ideas"; add IDEO framing: "IDEO-level out-of-the-box: weird material combinations, sensory/embodied designs, solving a problem the user doesn't know they have, designs that feel inevitable in retrospect. NOT incremental UX improvements."
- Phase 3.5 assertion: add `tinker.ideas.length` check → FATAL if zero, WARN if < 15
- Phase 1 Granola: add output schema `overview.granola: { meetingsReviewed, keyDecisions, topDecisions[] }`
- Phase 1 OMI: if MCP unavailable or returns empty, set `overview.omi = null` (not empty object) and emit WARN alert

**Verification:** SKILL.md diffs reviewed; Phase 3.5 assertion covers tinker

- [ ] **Unit 4: Patch 2026-04-19.json — all 5 sections**

**Goal:** Current week JSON reflects all fixes: Granola sub-object, OMI null, 20 Bumblebee, 14+ Skills, 20 Tinker

**Files:**
- Modify: `public/weeks/2026-04-19.json`

**Approach:**
- Add `overview.granola: { meetingsReviewed: 4, keyDecisions: 8, topDecisions: [...] }` (data already present in executiveSummary)
- Set `overview.omi = null` (OMI was not available this run — remove the misleading empty object)
- Expand `ideas.ideas` from 10 to 20: add 10 high-novelty cross-domain Bumblebee ideas anchored in Stefan's domains
- Expand `skills.automation` from 7 to 14: add 7 more automation candidates derived from workflow patterns
- Expand `tinker.ideas` from 12 to 20: replace all-medical-education ideas with a diverse IDEO-level set across food, culture, language, biosecurity, wellness — not just med-ed games

**Verification:** `python3 -c "import json; d=json.load(open('public/weeks/2026-04-19.json', encoding='utf-8')); print(len(d['ideas']['ideas']), len(d['skills']['automation']), len(d['tinker']['ideas']))"` → 20, 14+, 20

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| JSON patch introduces invalid JSON | Run `python3 -m json.tool` validation after edit |
| Bumblebee ideas too generic | Use specific cross-domain anchors from Stefan's actual work; reject any idea that fits one domain cleanly |
| Vercel deploy lag | Verify at live URL after push; Vercel deploys in ~60s |

## Sources & References

- `public/index.html:2019-2067` — source health badge rendering
- `public/weeks/2026-04-19.json` — current week data showing null omi/granola
- `C:\Users\stefa\Documents\Claude\Scheduled\optimus-weekly-run\SKILL.md` — generator skill
