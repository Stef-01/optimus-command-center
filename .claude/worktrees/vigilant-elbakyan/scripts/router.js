#!/usr/bin/env node
/**
 * router.js
 * Reads job packets from jobs/inbox/, classifies each with a route (1-7),
 * and moves them to jobs/ready/ with the route field added.
 *
 * Routing rules (deterministic — based on job type):
 *   Route 1 — Deterministic:     parse, diff, hash, rank, render, move, template
 *   Route 2 — Gemma Local:       compress, cluster, extract, dedupe, tag
 *   Route 3 — Claude Alone:      draft, brief, summarize, transform, plan-simple
 *   Route 4 — Octopus Claude:    research, requirements, plan-complex, review-internal
 *   Route 5 — Octopus + Codex:   architecture, code-review, security-review, pr-review
 *   Route 6 — Full Consensus:    ship-public, spec-to-software, adversarial-review
 *   Route 7 — Codex Direct:      implement, fix-bug, refactor, write-test, add-endpoint
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INBOX_DIR = path.join(ROOT, 'jobs', 'inbox');
const READY_DIR = path.join(ROOT, 'jobs', 'ready');

const ROUTE_MAP = {
  // Route 1: Deterministic
  parse: 1, diff: 1, hash: 1, rank: 1, render: 1, move: 1, template: 1,
  // Route 2: Gemma Local
  compress: 2, cluster: 2, extract: 2, dedupe: 2, tag: 2,
  // Route 3: Claude Alone
  draft: 3, brief: 3, summarize: 3, transform: 3, 'plan-simple': 3,
  // Route 4: Claude Octopus (Claude-only)
  research: 4, requirements: 4, 'plan-complex': 4, 'review-internal': 4,
  // Route 5: Octopus + Codex
  architecture: 5, 'code-review': 5, 'security-review': 5, 'pr-review': 5,
  // Route 6: Full Consensus
  'ship-public': 6, 'spec-to-software': 6, 'adversarial-review': 6,
  // Route 7: Codex Direct
  implement: 7, 'fix-bug': 7, refactor: 7, 'write-test': 7, 'add-endpoint': 7,
};

const ROUTE_LABELS = {
  1: 'Deterministic',
  2: 'Gemma Local',
  3: 'Claude Alone',
  4: 'Octopus Claude-only',
  5: 'Octopus + Codex',
  6: 'Full Consensus',
  7: 'Codex Direct',
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function classifyRoute(job) {
  const type = (job.type || '').toLowerCase();
  const route = ROUTE_MAP[type];
  if (!route) return null;
  return route;
}

function isJobPacket(filename) {
  // Only route .json files that are NOT delta files
  return filename.endsWith('.json') && !filename.startsWith('delta-');
}

function main() {
  ensureDir(READY_DIR);

  if (!fs.existsSync(INBOX_DIR)) {
    console.log('No inbox directory found. Nothing to route.');
    return;
  }

  const files = fs.readdirSync(INBOX_DIR).filter(isJobPacket);

  if (files.length === 0) {
    console.log('No job packets in inbox. Nothing to route.');
    return;
  }

  let routed = 0;
  let skipped = 0;

  for (const filename of files) {
    const inPath = path.join(INBOX_DIR, filename);
    let job;

    try {
      job = JSON.parse(fs.readFileSync(inPath, 'utf8'));
    } catch (err) {
      console.error(`✗ Could not parse ${filename}: ${err.message}`);
      skipped++;
      continue;
    }

    const route = classifyRoute(job);

    if (route === null) {
      console.warn(`? ${filename}: unknown type "${job.type}" — skipping (no route match)`);
      skipped++;
      continue;
    }

    const routedJob = {
      ...job,
      route,
      route_label: ROUTE_LABELS[route],
      status: 'ready',
      routed_at: new Date().toISOString(),
    };

    const outPath = path.join(READY_DIR, filename);
    fs.writeFileSync(outPath, JSON.stringify(routedJob, null, 2));
    fs.unlinkSync(inPath);

    console.log(`✓ ${filename} → Route ${route} (${ROUTE_LABELS[route]})`);
    routed++;
  }

  console.log(`\nRouted: ${routed}  Skipped: ${skipped}`);
}

main();
