#!/usr/bin/env node
// How an agent saves its work to main. It commits only the files that agent is
// allowed to change, rebuilds the feed, and pushes, starting again from the
// latest main if someone else pushed first.
//
// Usage: node scripts/save.mjs --agent <name> -m "Commit message"
//
// It refuses to save if the agent has touched anything outside its own files,
// so an agent can't change app code, another agent's work or a decision by
// accident. The Developer isn't listed: it works on a branch and opens a pull
// request, and never pushes to main.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

// What each agent may change on main. Paths ending in / are folders.
const ALLOWED = {
  // The Editor writes stories. It may not write verdicts, so it cannot release its own story.
  editor: ['content/issues/'],
  // The fact-checker corrects stories and writes verdicts.
  'fact-checker': ['content/issues/', 'content/checks/', 'content/start-here.json'],
  producer: ['videos/'],
  analyst: ['reports/'],
  // Support keeps a count only. Messages and replies never go in this public repo.
  support: ['support/status.json'],
};
// Written by build-feed.mjs; saved along with whatever caused them to change.
const GENERATED = ['content/feed.json', 'content/published/'];

const args = process.argv.slice(2);
const arg = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const agent = arg('--agent');
const message = arg('-m');
if (!agent || !ALLOWED[agent] || !message) {
  console.error(`Usage: node scripts/save.mjs --agent <${Object.keys(ALLOWED).join('|')}> -m "Commit message"`);
  process.exit(2);
}

const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' }).trim();
const tryGit = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });
const under = (path, list) => list.some((p) => (p.endsWith('/') ? path.startsWith(p) : path === p));
const build = () => spawnSync(process.execPath, [join(repo, 'scripts', 'build-feed.mjs')], { cwd: repo, stdio: 'inherit' }).status === 0;
const stop = (msg) => {
  console.error(`✗ Not saved. ${msg}`);
  process.exit(1);
};

// If the agent committed by itself, fold those commits back into the working
// folder so they go through the same checks as everything else.
if (Number(git('rev-list', '--count', 'origin/main..HEAD')) > 0) git('reset', '--quiet', '--mixed', 'origin/main');

// 1. Validate and regenerate, then see what changed.
if (!build()) stop('Fix the problems above, then run save again.');
// -z gives one entry per NUL with the path unquoted: "XY path", and for renames the old path follows as its own entry.
const entries = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], { cwd: repo, encoding: 'utf8' }).split('\0').filter(Boolean);
const changed = [];
for (let i = 0; i < entries.length; i++) {
  changed.push(entries[i].slice(3));
  if (/^[RC]/.test(entries[i])) changed.push(entries[++i]);
}
const outside = changed.filter((p) => !under(p, ALLOWED[agent]) && !under(p, GENERATED));
if (outside.length) {
  stop(
    `The ${agent} may only change ${ALLOWED[agent].join(', ')}, but these files were also changed:\n  ` +
      outside.join('\n  ') +
      '\nUndo those changes (git checkout -- <file>, or delete new files) and run save again.',
  );
}
const mine = changed.filter((p) => under(p, ALLOWED[agent]));
if (!mine.length) {
  console.log('Nothing to save.');
  process.exit(0);
}

// 2. Keep a copy of the agent's own files, so the work can be replayed on a newer main.
const keep = new Map(mine.map((p) => [p, existsSync(join(repo, p)) ? readFileSync(join(repo, p)) : null]));
const restore = () => {
  for (const [p, data] of keep) {
    if (data === null) rmSync(join(repo, p), { force: true });
    else {
      mkdirSync(dirname(join(repo, p)), { recursive: true });
      writeFileSync(join(repo, p), data);
    }
  }
};

for (let attempt = 1; attempt <= 4; attempt++) {
  const fetched = tryGit('fetch', '--quiet', 'origin', 'main');
  if (fetched.status !== 0) stop(`Could not reach GitHub (${fetched.stderr.trim()}).`);
  const head = git('rev-parse', 'HEAD');
  const tip = git('rev-parse', 'origin/main');
  if (head !== tip) {
    // Someone pushed since this agent started. If they changed the same file, stop rather than overwrite it.
    // (If this agent's copy already matches theirs, there is nothing to overwrite.)
    const theirs = (p) => {
      const r = spawnSync('git', ['show', `${tip}:${p}`], { cwd: repo });
      return r.status === 0 ? r.stdout : null;
    };
    const same = (a, b) => (a === null || b === null ? a === b : Buffer.compare(a, b) === 0);
    const clash = mine.filter((p) => tryGit('diff', '--quiet', head, tip, '--', p).status !== 0 && !same(keep.get(p), theirs(p)));
    if (clash.length) {
      restore();
      stop(
        `Someone else changed ${clash.join(', ')} on main while you were working. ` +
          'Your version is still in the working folder. Read theirs (git show origin/main:<file>), redo your change on top of it, and run save again.',
      );
    }
    git('reset', '--hard', '--quiet', tip);
    git('clean', '-fdq', '--', 'content', 'videos', 'reports', 'support');
    restore();
  }
  if (!build()) stop('The feed no longer builds on the latest main. Fix the problems above and run save again.');
  git('add', '-A', '--', ...mine, ...GENERATED.filter((p) => existsSync(join(repo, p))));
  if (tryGit('diff', '--cached', '--quiet').status === 0) {
    console.log('Nothing to save: main already has these changes.');
    process.exit(0);
  }
  git('commit', '--quiet', '-m', message);
  const pushed = tryGit('push', '--quiet', 'origin', 'HEAD:main');
  if (pushed.status === 0) {
    console.log(`✓ Saved to main as ${git('rev-parse', '--short', 'HEAD')}: ${message}`);
    process.exit(0);
  }
  // Rejected, most likely because main moved again. Undo the commit, keep the work, and retry.
  git('reset', '--hard', '--quiet', 'HEAD~1');
  restore();
  console.error(`Push ${attempt} was rejected (${pushed.stderr.trim().split('\n')[0]}); retrying on the latest main.`);
}
stop('GitHub rejected the push four times. Nothing was published; say so in your report.');
