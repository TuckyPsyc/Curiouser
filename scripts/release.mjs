#!/usr/bin/env node
// Releases a story without a completed fact-check. This is Carl's override as
// editor-in-chief, run by .github/workflows/release.yml when he closes a release
// ticket or starts "Release a story" by hand. Agents never run it.
//
// Usage: node scripts/release.mjs [story number] [--note "why"]
//   With no number, releases the newest story readers can't yet see.
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checksDir, checkPath, loadStories } from './lib/state.mjs';

const args = process.argv.slice(2);
const noteAt = args.indexOf('--note');
const note = noteAt >= 0 ? args[noteAt + 1] : '';
const wanted = args.find((a) => /^\d+$/.test(a));

const { stories } = loadStories();
const unreleased = stories.filter((s) => s.status !== 'released');
const story = wanted ? stories.find((s) => s.id === Number(wanted)) : unreleased.at(-1);

if (!story) {
  console.error(wanted ? `There is no story No. ${wanted}.` : 'Nothing to release: every story is already published.');
  process.exit(wanted ? 1 : 0);
}
if (story.status === 'released') {
  console.log(`No. ${story.id} "${story.title}" is already published (${story.check.verdict}). Nothing changed.`);
  process.exit(0);
}

const before = story.check;
const now = new Date().toISOString();
const check = {
  issue: story.id,
  verdict: 'released-unchecked',
  by: 'editor-in-chief',
  at: now,
  summary: before?.verdict === 'held'
    ? 'Released by the editor-in-chief although the fact-checker held it. The problems it found are listed below.'
    : 'Released by the editor-in-chief without a completed fact-check.',
  ...(note ? { note } : {}),
  changes: before?.changes ?? [],
  problems: before?.problems ?? [],
  ...(before ? { history: [...(before.history ?? []), { verdict: before.verdict, by: before.by, at: before.at, summary: before.summary }] } : {}),
};
mkdirSync(checksDir, { recursive: true });
writeFileSync(checkPath(story.id), JSON.stringify(check, null, 2) + '\n');

const build = spawnSync(process.execPath, [fileURLToPath(new URL('./build-feed.mjs', import.meta.url))], { stdio: 'inherit', env: process.env });
if (build.status !== 0) {
  console.error(`No. ${story.id} could not be released: the story fails validation (see above).`);
  process.exit(1);
}
console.log(`Released No. ${story.id} "${story.title}" (was: ${story.status}).`);
if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `id=${story.id}\ntitle=${story.title.replace(/\n/g, ' ')}\n`, { flag: 'a' });
}
