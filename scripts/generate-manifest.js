#!/usr/bin/env node
/**
 * generate-manifest.js
 * Reads the latest week JSON from public/weeks/ and writes public/optimus.json
 */

const fs = require('fs');
const path = require('path');

const WEEKS_DIR = path.join(__dirname, '..', 'public', 'weeks');
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'optimus.json');

function getLatestWeekFile() {
  const index = JSON.parse(fs.readFileSync(path.join(WEEKS_DIR, 'index.json'), 'utf8'));
  // index.json lists weeks; pick the first (most recent) entry
  const weeks = Array.isArray(index) ? index : (index.weeks || index.available || Object.keys(index));
  const sorted = weeks
    .map(w => (typeof w === 'object' ? w.date || w.weekOf || w : w))
    .filter(Boolean)
    .sort()
    .reverse();
  return path.join(WEEKS_DIR, `${sorted[0]}.json`);
}

function impactToEnergy(impact) {
  if (!impact) return 'medium';
  const lower = impact.toLowerCase();
  if (lower.includes('extremely') || lower.includes('very high') || lower.includes('meta')) return 'high';
  if (lower.includes('high')) return 'medium';
  return 'low';
}

function projectStageFromAlignment(item) {
  if (!item.status) return 'active';
  if (item.status === 'good') return 'active';
  if (item.status === 'critical') return 'paused';
  return 'active';
}

function padId(prefix, n) {
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

function extractFocus(executiveSummary) {
  // Strip HTML tags and split into bullet-like sentences for focus array
  const clean = executiveSummary.replace(/<[^>]+>/g, '');
  // Pull out sentences after em dashes or periods as focus items
  const sentences = clean.split(/[.!]/).map(s => s.trim()).filter(s => s.length > 20);
  return sentences.slice(0, 3);
}

function buildTasks(lifeAdmin) {
  return (lifeAdmin.tasks || []).map((t, i) => ({
    id: padId('task', i + 1),
    title: t.title,
    type: t.source
      ? t.source.toLowerCase().includes('omi') ? 'verbal-commitment'
      : t.source.toLowerCase().includes('airtable') ? 'tracked'
      : 'admin'
      : 'admin',
    priority: t.priority || 'medium',
    status: 'open',
    project: t.source || null,
    due: null,
    notes: t.description || null,
  }));
}

function buildProjects(overview) {
  const alignment = overview.crossSourceAlignment || [];
  const priorities = overview.priorities || [];

  return alignment.map((item, i) => {
    const related = priorities.filter(p =>
      p.title && item.initiative &&
      p.title.toLowerCase().includes(item.initiative.toLowerCase().split(' ')[0].toLowerCase())
    );
    const desiredOutputs = related.map(p => p.detail).filter(Boolean);
    return {
      id: padId('proj', i + 1),
      name: item.initiative,
      stage: projectStageFromAlignment(item),
      desired_outputs: desiredOutputs.length > 0 ? desiredOutputs : [`Advance ${item.initiative}`],
    };
  });
}

function buildIdeas(ideasSection) {
  return (ideasSection.ideas || []).map((idea, i) => {
    let nextAction = 'Explore further';
    if (idea.status === 'in-progress') nextAction = 'Continue development';
    else if (idea.status === 'not-started') nextAction = 'Draft initial concept';

    return {
      id: padId('idea', i + 1),
      title: idea.title,
      energy: impactToEnergy(idea.impact),
      theme: (idea.category || '').replace(/^[^\s]+\s/, ''), // strip emoji prefix
      next_action: nextAction,
    };
  });
}

function main() {
  const weekFile = getLatestWeekFile();
  console.log(`Reading: ${weekFile}`);
  const week = JSON.parse(fs.readFileSync(weekFile, 'utf8'));

  const manifest = {
    updated_at: new Date().toISOString(),
    week_of: week.weekOf,
    focus: extractFocus(week.overview.executiveSummary || ''),
    tasks: buildTasks(week.lifeAdmin),
    projects: buildProjects(week.overview),
    ideas: buildIdeas(week.ideas),
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Written: ${OUTPUT_PATH}`);
  console.log(`  ${manifest.tasks.length} tasks, ${manifest.projects.length} projects, ${manifest.ideas.length} ideas`);
}

main();
