#!/usr/bin/env node
/**
 * watch.js
 * Orchestrator: runs generate-manifest → delta-parser and logs changes.
 * Called by scheduled tasks to keep optimus.json and job inbox current.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const INBOX_DIR = path.join(ROOT, 'jobs', 'inbox');

function run(script) {
  const scriptPath = path.join(__dirname, script);
  console.log(`\n▶ Running ${script}...`);
  try {
    const output = execSync(`node "${scriptPath}"`, { cwd: ROOT, encoding: 'utf8' });
    process.stdout.write(output);
  } catch (err) {
    console.error(`✗ ${script} failed:`);
    console.error(err.message);
    process.exit(1);
  }
}

function getLatestDelta() {
  if (!fs.existsSync(INBOX_DIR)) return null;
  const files = fs.readdirSync(INBOX_DIR)
    .filter(f => f.startsWith('delta-') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (!files.length) return null;
  return JSON.parse(fs.readFileSync(path.join(INBOX_DIR, files[0]), 'utf8'));
}

function logSummary(delta) {
  if (!delta) return;
  const s = delta.summary;
  console.log('\n── Delta Summary ─────────────────────────────');
  if (delta.bootstrap) {
    console.log(`  Bootstrap run: ${s.added} items loaded into job inbox`);
  } else {
    console.log(`  From: ${delta.from_week || 'unknown'} → To: ${delta.to_week || 'unknown'}`);
    console.log(`  Added: ${s.added}  Changed: ${s.changed}  Removed: ${s.removed}`);
    if (s.promoted_ideas > 0) console.log(`  Ideas promoted: ${s.promoted_ideas}`);
    if (s.dropped_ideas > 0)  console.log(`  Ideas dropped:  ${s.dropped_ideas}`);
    if (s.total === 0)        console.log('  No changes detected.');
  }
  console.log('──────────────────────────────────────────────\n');
}

function main() {
  const startedAt = new Date().toISOString();
  console.log(`\n═══ Optimus Watch — ${startedAt} ═══`);

  run('generate-manifest.js');
  run('delta-parser.js');

  const delta = getLatestDelta();
  logSummary(delta);

  console.log('✓ Watch complete.\n');
}

main();
