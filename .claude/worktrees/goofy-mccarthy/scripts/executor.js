#!/usr/bin/env node
/**
 * executor.js
 * Main execution loop. Reads jobs from jobs/ready/ sorted by priority,
 * dispatches each to the appropriate worker based on route, and manages
 * job lifecycle: ready → running → done/review.
 *
 * Route dispatch:
 *   Route 1 — Deterministic:   runs inline (no external worker needed)
 *   Route 2 — Gemma Local:     placeholder (not yet available)
 *   Route 3 — Claude Alone:    instruction to use `claude -p`
 *   Route 4 — Octopus Claude:  instruction to invoke via Claude Code plugin
 *   Route 5 — Octopus + Codex: delegates to codex-worker.js
 *   Route 6 — Full Consensus:  instruction to invoke via Claude Code plugin
 *   Route 7 — Codex Direct:    delegates to codex-worker.js
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const READY_DIR = path.join(ROOT, 'jobs', 'ready');
const RUNNING_DIR = path.join(ROOT, 'jobs', 'running');
const DONE_DIR = path.join(ROOT, 'jobs', 'done');
const REVIEW_DIR = path.join(ROOT, 'jobs', 'review');
const CODEX_WORKER = path.join(__dirname, 'codex-worker.js');

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadJobs() {
  if (!fs.existsSync(READY_DIR)) return [];

  const files = fs.readdirSync(READY_DIR).filter(f => f.endsWith('.json'));
  const jobs = [];

  for (const filename of files) {
    try {
      const jobPath = path.join(READY_DIR, filename);
      const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
      jobs.push({ filename, jobPath, job });
    } catch (err) {
      console.warn(`? Could not parse ${filename}: ${err.message}`);
    }
  }

  // Sort by priority: high → medium → low → undefined
  jobs.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.job.priority] ?? 99;
    const pb = PRIORITY_ORDER[b.job.priority] ?? 99;
    return pa - pb;
  });

  return jobs;
}

function moveToReview(job, jobPath, reason) {
  const reviewPath = path.join(REVIEW_DIR, path.basename(jobPath));
  const failedJob = {
    ...job,
    status: 'review',
    executor_note: reason,
    flagged_at: new Date().toISOString(),
  };
  fs.writeFileSync(reviewPath, JSON.stringify(failedJob, null, 2));
  if (fs.existsSync(jobPath)) fs.unlinkSync(jobPath);
  console.log(`  → Moved to review: ${path.basename(reviewPath)}`);
}

function moveToDone(job, jobPath, note) {
  const donePath = path.join(DONE_DIR, path.basename(jobPath));
  const doneJob = {
    ...job,
    status: 'done',
    executor_note: note,
    completed_at: new Date().toISOString(),
  };
  fs.writeFileSync(donePath, JSON.stringify(doneJob, null, 2));
  if (fs.existsSync(jobPath)) fs.unlinkSync(jobPath);
  console.log(`  → Moved to done: ${path.basename(donePath)}`);
}

// Route 1: run inline — deterministic operations don't need an external worker
function executeRoute1(job, jobPath) {
  console.log(`  [Route 1 — Deterministic] Job type "${job.type}" runs inline.`);
  console.log(`  No external worker needed. Marking done.`);
  moveToDone(job, jobPath, `Deterministic job type "${job.type}" — executor acknowledged, no worker required.`);
  return true;
}

// Route 2: Gemma local — not yet available
function executeRoute2(job, jobPath) {
  console.log(`  [Route 2 — Gemma Local] Not yet available.`);
  console.log(`  Gemma 4 local preprocessing is planned for V6.`);
  moveToReview(job, jobPath, 'Gemma Local worker not yet available. Planned for V6.');
  return false;
}

// Route 3: Claude Alone — hand off to Claude Code CLI
function executeRoute3(job, jobPath) {
  console.log(`  [Route 3 — Claude Alone] Use Claude Code CLI:`);
  console.log(`  claude -p "${job.inputs?.description || job.title}"`);
  moveToReview(job, jobPath, `Claude Alone: run manually with \`claude -p\`. Prompt: ${job.inputs?.description || job.title}`);
  return false;
}

// Route 4: Octopus Claude-only — structured workflow via Claude Code plugin
function executeRoute4(job, jobPath) {
  console.log(`  [Route 4 — Octopus Claude-only] Invoke via Claude Code Octopus plugin.`);
  console.log(`  Use /ce:work or Claude Octopus plugin in Claude Code session.`);
  moveToReview(job, jobPath, 'Octopus workflow: invoke via Claude Code plugin. Route 4 = Claude-only structured phases.');
  return false;
}

// Route 5: Octopus + Codex — delegates to codex-worker.js for packet prep
function executeRoute5(job, jobPath) {
  console.log(`  [Route 5 — Octopus + Codex] Preparing Octopus + Codex packet...`);
  const result = spawnSync('node', [CODEX_WORKER, jobPath], {
    encoding: 'utf8',
    cwd: ROOT,
    shell: false,
  });
  process.stdout.write(result.stdout || '');
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status === 0;
}

// Route 6: Full Consensus — rare, requires human + Claude Octopus
function executeRoute6(job, jobPath) {
  console.log(`  [Route 6 — Full Consensus] Requires human review + Claude Octopus adversarial workflow.`);
  console.log(`  This is the highest-stakes route. Do not automate.`);
  moveToReview(job, jobPath, 'Full Consensus: requires human + Octopus adversarial review before any action.');
  return false;
}

// Route 7: Codex Direct — delegates to codex-worker.js
function executeRoute7(job, jobPath) {
  console.log(`  [Route 7 — Codex Direct] Dispatching to codex-worker.js...`);
  const result = spawnSync('node', [CODEX_WORKER, jobPath], {
    encoding: 'utf8',
    cwd: ROOT,
    shell: false,
  });
  process.stdout.write(result.stdout || '');
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status === 0;
}

const ROUTE_HANDLERS = {
  1: executeRoute1,
  2: executeRoute2,
  3: executeRoute3,
  4: executeRoute4,
  5: executeRoute5,
  6: executeRoute6,
  7: executeRoute7,
};

function main() {
  ensureDir(RUNNING_DIR);
  ensureDir(DONE_DIR);
  ensureDir(REVIEW_DIR);

  const startedAt = new Date().toISOString();
  console.log(`\n═══ Optimus Executor — ${startedAt} ═══\n`);

  const jobs = loadJobs();

  if (jobs.length === 0) {
    console.log('No jobs in ready/. Nothing to execute.');
    return;
  }

  console.log(`Found ${jobs.length} job(s) in ready/ — sorted by priority.\n`);

  let succeeded = 0;
  let failed = 0;

  for (const { filename, jobPath, job } of jobs) {
    const route = job.route;
    const label = job.route_label || `Route ${route}`;

    console.log(`── ${job.id || filename} ─────────────────────────────────`);
    console.log(`  Title:    ${job.title}`);
    console.log(`  Type:     ${job.type}`);
    console.log(`  Priority: ${job.priority || 'unset'}`);
    console.log(`  Route:    ${route} — ${label}`);

    const handler = ROUTE_HANDLERS[route];

    if (!handler) {
      console.error(`  ✗ No handler for route ${route}. Moving to review.`);
      moveToReview(job, jobPath, `Unknown route: ${route}`);
      failed++;
      continue;
    }

    const success = handler(job, jobPath);
    if (success) succeeded++;
    else failed++;

    console.log('');
  }

  console.log(`═══ Executor complete ════════════════════════════════`);
  console.log(`  Succeeded: ${succeeded}  Failed/Deferred: ${failed}`);
  console.log('');
}

main();
