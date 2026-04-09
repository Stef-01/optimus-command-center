#!/usr/bin/env node
/**
 * delta-parser.js
 * Computes diff between current optimus.json and previous cached manifest.
 * Writes delta to jobs/inbox/delta-YYYY-MM-DD.json
 * Caches current manifest as .cache/previous-manifest.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'public', 'optimus.json');
const CACHE_PATH = path.join(ROOT, '.cache', 'previous-manifest.json');
const INBOX_DIR = path.join(ROOT, 'jobs', 'inbox');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function indexById(items) {
  const map = {};
  for (const item of items) map[item.id] = item;
  return map;
}

function computeListDelta(label, previous, current) {
  const prevMap = indexById(previous);
  const currMap = indexById(current);
  const changes = [];

  for (const item of current) {
    if (!prevMap[item.id]) {
      changes.push({ type: 'added', entity: label, id: item.id, data: item });
    } else {
      const prev = prevMap[item.id];
      const diffs = {};
      for (const key of Object.keys(item)) {
        if (JSON.stringify(item[key]) !== JSON.stringify(prev[key])) {
          diffs[key] = { from: prev[key], to: item[key] };
        }
      }
      if (Object.keys(diffs).length > 0) {
        changes.push({ type: 'changed', entity: label, id: item.id, changes: diffs });
      }
    }
  }

  for (const item of previous) {
    if (!currMap[item.id]) {
      changes.push({ type: 'removed', entity: label, id: item.id, data: item });
    }
  }

  return changes;
}

function computeDelta(previous, current) {
  const delta = {
    computed_at: new Date().toISOString(),
    from_week: previous.week_of || null,
    to_week: current.week_of || null,
    changes: [],
  };

  // Tasks delta
  delta.changes.push(...computeListDelta('task', previous.tasks || [], current.tasks || []));

  // Projects delta
  delta.changes.push(...computeListDelta('project', previous.projects || [], current.projects || []));

  // Ideas delta (promoted = status changed to in-progress, dropped = removed)
  const ideaDelta = computeListDelta('idea', previous.ideas || [], current.ideas || []);
  // Annotate promotions
  for (const change of ideaDelta) {
    if (change.type === 'changed' && change.changes?.next_action) {
      const from = change.changes.next_action.from;
      const to = change.changes.next_action.to;
      if (to === 'Continue development' && from !== 'Continue development') {
        change.annotation = 'promoted';
      }
    }
    if (change.type === 'removed') {
      change.annotation = 'dropped';
    }
  }
  delta.changes.push(...ideaDelta);

  // Focus change
  if (JSON.stringify(previous.focus) !== JSON.stringify(current.focus)) {
    delta.changes.push({
      type: 'changed',
      entity: 'focus',
      id: 'focus',
      changes: { focus: { from: previous.focus, to: current.focus } },
    });
  }

  delta.summary = {
    total: delta.changes.length,
    added: delta.changes.filter(c => c.type === 'added').length,
    changed: delta.changes.filter(c => c.type === 'changed').length,
    removed: delta.changes.filter(c => c.type === 'removed').length,
    promoted_ideas: delta.changes.filter(c => c.annotation === 'promoted').length,
    dropped_ideas: delta.changes.filter(c => c.annotation === 'dropped').length,
  };

  return delta;
}

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('ERROR: public/optimus.json not found. Run npm run manifest first.');
    process.exit(1);
  }

  const current = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  const today = new Date().toISOString().slice(0, 10);
  const outPath = path.join(INBOX_DIR, `delta-${today}.json`);

  ensureDir(path.join(ROOT, '.cache'));
  ensureDir(INBOX_DIR);

  if (!fs.existsSync(CACHE_PATH)) {
    // First run — no previous manifest, write a bootstrap delta
    console.log('No previous manifest found. Writing bootstrap delta.');
    const bootstrapDelta = {
      computed_at: new Date().toISOString(),
      from_week: null,
      to_week: current.week_of || null,
      bootstrap: true,
      changes: [
        ...current.tasks.map(t => ({ type: 'added', entity: 'task', id: t.id, data: t })),
        ...current.projects.map(p => ({ type: 'added', entity: 'project', id: p.id, data: p })),
        ...current.ideas.map(i => ({ type: 'added', entity: 'idea', id: i.id, data: i })),
      ],
      summary: {
        total: current.tasks.length + current.projects.length + current.ideas.length,
        added: current.tasks.length + current.projects.length + current.ideas.length,
        changed: 0,
        removed: 0,
        promoted_ideas: 0,
        dropped_ideas: 0,
      },
    };
    fs.writeFileSync(outPath, JSON.stringify(bootstrapDelta, null, 2));
    console.log(`Written: ${outPath}`);
    console.log(`  Bootstrap: ${bootstrapDelta.summary.added} items added`);
  } else {
    const previous = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    const delta = computeDelta(previous, current);
    fs.writeFileSync(outPath, JSON.stringify(delta, null, 2));
    console.log(`Written: ${outPath}`);
    console.log(`  ${delta.summary.added} added, ${delta.summary.changed} changed, ${delta.summary.removed} removed`);
  }

  // Cache current manifest as previous for next run
  fs.writeFileSync(CACHE_PATH, JSON.stringify(current, null, 2));
  console.log(`Cached: ${CACHE_PATH}`);
}

main();
