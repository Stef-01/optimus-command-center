#!/usr/bin/env node
/**
 * codex-worker.js
 * Executes a job packet using Codex CLI (Route 7: Codex Direct).
 * Also handles Route 5 task preparation (Octopus + Codex review).
 *
 * Usage:
 *   node scripts/codex-worker.js <path-to-job-packet.json>
 *
 * Codex CLI invocation:
 *   codex --full-auto -q "task description"
 *
 * Falls back gracefully if Codex CLI is not installed.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DONE_DIR = path.join(ROOT, 'jobs', 'done');
const REVIEW_DIR = path.join(ROOT, 'jobs', 'review');
const RUNNING_DIR = path.join(ROOT, 'jobs', 'running');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function isCodexAvailable() {
  try {
    const result = spawnSync('codex', ['--version'], { encoding: 'utf8', shell: true });
    return result.status === 0;
  } catch {
    return false;
  }
}

function buildPrompt(job) {
  const lines = [];
  lines.push(`Task: ${job.title}`);
  if (job.inputs?.description) {
    lines.push(`\nDescription: ${job.inputs.description}`);
  }
  if (job.inputs?.target_file) {
    lines.push(`\nTarget file: ${job.inputs.target_file}`);
  }
  if (job.expected_outputs?.length) {
    lines.push(`\nExpected outputs: ${job.expected_outputs.join(', ')}`);
  }
  if (job.inputs?.context) {
    lines.push(`\nAdditional context: ${job.inputs.context}`);
  }
  return lines.join('');
}

function buildOctopusPacket(job) {
  return {
    workflow: 'octopus-codex-review',
    job_id: job.id,
    title: job.title,
    type: job.type,
    route: job.route,
    route_label: job.route_label,
    phases: {
      discover: `Understand the codebase context for: ${job.title}`,
      define: `Define requirements and acceptance criteria for: ${job.inputs?.description || job.title}`,
      develop: `Codex will implement: ${buildPrompt(job)}`,
      deliver: `Review Codex output against requirements and validate correctness`,
    },
    inputs: job.inputs,
    expected_outputs: job.expected_outputs,
  };
}

function runCodex(job) {
  const prompt = buildPrompt(job);
  console.log(`\n▶ Invoking Codex for job: ${job.id}`);
  console.log(`  Prompt: ${prompt.slice(0, 120)}${prompt.length > 120 ? '...' : ''}`);

  // Pass prompt via stdin ('-') to avoid shell quoting/newline issues on Windows
  const result = spawnSync('codex', ['exec', '--full-auto', '-'], {
    encoding: 'utf8',
    input: prompt,
    shell: true,
    cwd: ROOT,
    timeout: 300_000, // 5 minute timeout
  });

  if (result.error) {
    throw new Error(`Codex spawn error: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`Codex exited with code ${result.status}:\n${result.stderr || '(no stderr)'}`);
  }

  return {
    exit_code: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function processRoute7(job, jobPath) {
  const runningPath = path.join(RUNNING_DIR, path.basename(jobPath));

  // Move to running
  fs.writeFileSync(runningPath, JSON.stringify({ ...job, status: 'running', started_at: new Date().toISOString() }, null, 2));
  if (fs.existsSync(jobPath)) fs.unlinkSync(jobPath);

  if (!isCodexAvailable()) {
    console.warn('⚠ Codex CLI not found. Install with: npm install -g @openai/codex');
    console.warn('  Falling back: writing job to review/ for manual execution.');

    const fallbackJob = {
      ...job,
      status: 'review',
      fallback: true,
      fallback_reason: 'Codex CLI not installed',
      fallback_prompt: buildPrompt(job),
      fallback_command: `codex exec --full-auto "${buildPrompt(job).replace(/"/g, '\\"')}"`,
      reviewed_at: new Date().toISOString(),
    };

    const reviewPath = path.join(REVIEW_DIR, path.basename(jobPath));
    fs.writeFileSync(reviewPath, JSON.stringify(fallbackJob, null, 2));
    if (fs.existsSync(runningPath)) fs.unlinkSync(runningPath);

    console.log(`  Written to: ${reviewPath}`);
    return { success: false, fallback: true };
  }

  try {
    const codexResult = runCodex(job);

    const doneJob = {
      ...job,
      status: 'done',
      completed_at: new Date().toISOString(),
      result: {
        worker: 'codex',
        exit_code: codexResult.exit_code,
        stdout: codexResult.stdout,
      },
    };

    const donePath = path.join(DONE_DIR, path.basename(jobPath));
    fs.writeFileSync(donePath, JSON.stringify(doneJob, null, 2));
    if (fs.existsSync(runningPath)) fs.unlinkSync(runningPath);

    console.log(`✓ Job complete: ${donePath}`);
    if (codexResult.stdout) {
      console.log('\n── Codex Output ──────────────────────────────');
      console.log(codexResult.stdout.trim());
      console.log('──────────────────────────────────────────────');
    }

    return { success: true };
  } catch (err) {
    const failedJob = {
      ...job,
      status: 'review',
      error: err.message,
      failed_at: new Date().toISOString(),
    };

    const reviewPath = path.join(REVIEW_DIR, path.basename(jobPath));
    fs.writeFileSync(reviewPath, JSON.stringify(failedJob, null, 2));
    if (fs.existsSync(runningPath)) fs.unlinkSync(runningPath);

    console.error(`✗ Codex failed: ${err.message}`);
    console.log(`  Written to review: ${reviewPath}`);
    return { success: false, error: err.message };
  }
}

function processRoute5(job, jobPath) {
  console.log(`\n▶ Route 5 (Octopus + Codex): preparing task packet for ${job.id}`);

  const packet = buildOctopusPacket(job);

  const reviewJob = {
    ...job,
    status: 'review',
    octopus_packet: packet,
    instructions: 'Invoke via Claude Octopus plugin using the octopus_packet above. After Octopus phases complete, run Codex on the implement sub-task.',
    prepared_at: new Date().toISOString(),
  };

  const reviewPath = path.join(REVIEW_DIR, path.basename(jobPath));
  fs.writeFileSync(reviewPath, JSON.stringify(reviewJob, null, 2));
  if (fs.existsSync(jobPath)) fs.unlinkSync(jobPath);

  console.log(`✓ Octopus packet written: ${reviewPath}`);
  console.log('  Phases: Discover → Define → Develop (Codex) → Deliver');
  return { success: true, route5: true };
}

function main() {
  ensureDir(DONE_DIR);
  ensureDir(REVIEW_DIR);
  ensureDir(RUNNING_DIR);

  const jobPath = process.argv[2];

  if (!jobPath) {
    console.error('Usage: node scripts/codex-worker.js <path-to-job-packet.json>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(jobPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`ERROR: Job file not found: ${resolvedPath}`);
    process.exit(1);
  }

  let job;
  try {
    job = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (err) {
    console.error(`ERROR: Could not parse job file: ${err.message}`);
    process.exit(1);
  }

  const route = job.route;

  if (route === 7) {
    const result = processRoute7(job, resolvedPath);
    process.exit(result.success ? 0 : 1);
  } else if (route === 5) {
    const result = processRoute5(job, resolvedPath);
    process.exit(result.success ? 0 : 1);
  } else {
    console.error(`ERROR: codex-worker only handles Route 5 and Route 7. Got route: ${route}`);
    process.exit(1);
  }
}

main();
