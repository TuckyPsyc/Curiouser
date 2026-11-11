#!/usr/bin/env node
// Puts a folder of screenshots on the `screenshots` branch and prints Markdown
// that shows them side by side, light and dark, ready to paste into a pull request.
// Keeping them on their own branch means pictures never bloat main.
//
// Usage: node scripts/share-screenshots.mjs <name> <folder>
//   e.g. node scripts/share-screenshots.mjs sunday-reminder shots
import { execFileSync } from 'node:child_process';
import { readdirSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const [name, folder] = process.argv.slice(2);
if (!name || !folder || !/^[\w-]+$/.test(name)) {
  console.error('Usage: node scripts/share-screenshots.mjs <name> <folder>   (name: letters, numbers and hyphens)');
  process.exit(2);
}
const dir = resolve(folder);
const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
if (!files.length) {
  console.error(`No PNG files in ${dir}.`);
  process.exit(1);
}

// Build the commit without touching the working folder or the current branch.
const env = { ...process.env, GIT_INDEX_FILE: join(mkdtempSync(join(tmpdir(), 'shots-')), 'index') };
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', env }).trim();
let parent = null;
try {
  git('fetch', '--quiet', 'origin', 'screenshots:refs/remotes/origin/screenshots');
  parent = git('rev-parse', 'origin/screenshots');
  git('read-tree', parent);
} catch {
  // First time: the branch doesn't exist yet.
}
for (const f of files) {
  const blob = git('hash-object', '-w', join(dir, f));
  git('update-index', '--add', '--cacheinfo', `100644,${blob},${name}/${f}`);
}
const tree = git('write-tree');
const commit = git('commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', `Screenshots: ${name}`);
git('push', '--quiet', 'origin', `${commit}:refs/heads/screenshots`);

const slug = git('remote', 'get-url', 'origin').replace(/^.*github\.com[:/]/, '').replace(/\.git$/, '');
const url = (f) => `https://raw.githubusercontent.com/${slug}/${commit}/${name}/${f}`;
const screens = [...new Set(files.map((f) => f.replace(/-(light|dark)\.png$/, '')))];
const cell = (f) => (files.includes(f) ? `<img src="${url(f)}" width="280" alt="${f.replace('.png', '')}">` : '');
console.log(['| | Light | Dark |', '|---|---|---|', ...screens.map((s) => `| ${s} | ${cell(`${s}-light.png`)} | ${cell(`${s}-dark.png`)} |`)].join('\n'));
