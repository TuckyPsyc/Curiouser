#!/usr/bin/env node
// Tests the one rule that matters most: a story readers haven't been cleared to
// see never reaches them. Runs against a scratch copy, so it changes nothing here.
// Usage: node scripts/test-gate.mjs
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { topicFor, pad } from './lib/state.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const scratch = mkdtempSync(join(tmpdir(), 'curiouser-gate-'));
cpSync(join(repo, 'content'), join(scratch, 'content'), { recursive: true });

const env = { ...process.env, CURIOUSER_ROOT: scratch };
const run = (script, ...args) => spawnSync(process.execPath, [join(here, script), ...args], { env, encoding: 'utf8' });
const read = (p) => JSON.parse(readFileSync(join(scratch, p), 'utf8'));
const write = (p, v) => {
  mkdirSync(dirname(join(scratch, p)), { recursive: true });
  writeFileSync(join(scratch, p), JSON.stringify(v, null, 2) + '\n');
};

let failed = 0;
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failed++;
    console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`);
  }
};
const builds = () => run('build-feed.mjs').status === 0;
const inFeed = (id) => read('content/feed.json').issues.some((i) => i.id === id);
const inSeed = (id) => String(id) in read('src/data/seed.json').issues;
const fetchable = (id) => existsSync(join(scratch, 'content', 'published', `${pad(id)}.json`));
const visible = (id) => inFeed(id) || inSeed(id) || fetchable(id);

console.log('The gate');
ok('the repo as it stands builds', builds());
const before = read('content/feed.json');
const last = Math.max(...before.issues.map((i) => i.id));
const n = last + 1;
const m = last + 2;
const draft = (id, recallFrom) => ({
  ...read(`content/issues/${pad(last)}.json`),
  id,
  date: '2099-01-01',
  topic: topicFor(id),
  title: `Test story ${id}`,
  concept: `Test concept ${id}`,
  recall: { question: 'A question?', answer: 'An answer.', fromIssue: recallFrom },
});
const checkFile = (id) => `content/checks/${pad(id)}.json`;
const verdict = (id, v, extra = {}) => ({
  issue: id, verdict: v, by: 'fact-checker', at: '2099-01-01T05:50:00Z', summary: 'Test.',
  claims: { checked: 40, confirmed: 40, corrected: 0, removed: 0 }, links: { checked: 6, working: 6, replaced: 0, removed: 0 },
  changes: [], problems: [], ...extra,
});

write(`content/issues/${pad(n)}.json`, draft(n, last));
ok('a new story with no verdict still builds', builds());
ok('…and readers cannot see it (feed, bundled seed or direct fetch)', !visible(n));
ok('…and feed.json is byte-for-byte unchanged', JSON.stringify(read('content/feed.json')) === JSON.stringify(before));

write(checkFile(n), verdict(n, 'held', { problems: [{ where: 'story ¶1', problem: 'Test problem.' }] }));
ok('a held story builds', builds());
ok('…and readers cannot see it', !visible(n));

write(`content/issues/${pad(m)}.json`, draft(m, n));
ok('a draft may not ask readers to recall a story they never saw', !builds());
rmSync(join(scratch, 'content', 'issues', `${pad(m)}.json`));

write(checkFile(n), verdict(n, 'checked'));
ok('an unknown verdict ("checked") is rejected', !builds());
write(checkFile(n), verdict(n, 'fixed'));
ok('"fixed" with no list of changes is rejected', !builds());
write(checkFile(n), verdict(n, 'held'));
ok('"held" with no list of problems is rejected', !builds());
write(checkFile(n), { ...verdict(n, 'pass'), by: 'editor' });
ok('a verdict from anyone but the fact-checker or editor-in-chief is rejected', !builds());

write(checkFile(n), { ...verdict(n, 'pass'), claims: undefined });
ok('a fact-checker verdict with no count of claims checked is rejected', !builds());

write(checkFile(n), verdict(n, 'pass'));
ok('a "pass" verdict builds', builds());
ok('…and releases the story everywhere', inFeed(n) && inSeed(n) && fetchable(n));

rmSync(join(scratch, checkFile(n)));
ok('removing the verdict builds', builds());
ok('…and takes the story back out everywhere', !visible(n));

write(checkFile(n), verdict(n, 'held', { problems: [{ where: 'story ¶1', problem: 'Test problem.' }] }));
const rel = run('release.mjs');
const after = existsSync(join(scratch, checkFile(n))) ? read(checkFile(n)) : {};
ok('release.mjs releases the newest unpublished story', rel.status === 0 && visible(n), rel.stderr);
ok('…records it as the editor-in-chief\'s decision, not a check', after.verdict === 'released-unchecked' && after.by === 'editor-in-chief');
ok('…and keeps the fact-checker\'s problems and history', after.problems?.length === 1 && after.history?.[0]?.verdict === 'held');
ok('release.mjs with nothing left to release changes nothing', run('release.mjs').status === 0);

// save.mjs: what each agent may push. Uses a throwaway repo with a local "GitHub".
console.log('Saving');
const work = mkdtempSync(join(tmpdir(), 'curiouser-save-'));
const origin = join(work, 'origin.git');
const clone = join(work, 'clone');
const other = join(work, 'other');
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const id = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com'];
execFileSync('git', ['init', '--quiet', '--bare', '-b', 'main', origin]);
mkdirSync(clone);
git(clone, 'init', '--quiet', '-b', 'main');
cpSync(join(repo, 'content'), join(clone, 'content'), { recursive: true });
cpSync(join(repo, 'scripts'), join(clone, 'scripts'), { recursive: true });
writeFileSync(join(clone, '.gitignore'), 'src/data/seed.json\n');
writeFileSync(join(clone, 'README.md'), 'test\n');
git(clone, 'add', '-A');
git(clone, ...id, 'commit', '--quiet', '-m', 'start');
git(clone, 'remote', 'add', 'origin', origin);
git(clone, 'push', '--quiet', '-u', 'origin', 'main');
git(clone, 'config', 'user.name', 'Test');
git(clone, 'config', 'user.email', 'test@example.com');
execFileSync('git', ['clone', '--quiet', origin, other]);
git(other, 'config', 'user.name', 'Other');
git(other, 'config', 'user.email', 'other@example.com');

const save = (cwd, agent, msg) => spawnSync(process.execPath, [join(cwd, 'scripts', 'save.mjs'), '--agent', agent, '-m', msg], { cwd, encoding: 'utf8', env: { ...process.env, CURIOUSER_ROOT: '' } });
const cwrite = (cwd, p, v) => {
  mkdirSync(dirname(join(cwd, p)), { recursive: true });
  writeFileSync(join(cwd, p), typeof v === 'string' ? v : JSON.stringify(v, null, 2) + '\n');
};
const onMain = (p) => spawnSync('git', ['cat-file', '-e', `main:${p}`], { cwd: origin }).status === 0;

cwrite(clone, `content/issues/${pad(n)}.json`, draft(n, last));
cwrite(clone, checkFile(n), verdict(n, 'pass'));
let r = save(clone, 'editor', 'Editor tries to release its own story');
ok('the Editor cannot save a verdict for its own story', r.status !== 0 && !onMain(checkFile(n)), r.stdout + r.stderr);
rmSync(join(clone, checkFile(n)));
cwrite(clone, 'README.md', 'changed\n');
r = save(clone, 'editor', 'Editor edits the README');
ok('an agent cannot save a file outside its own', r.status !== 0);
git(clone, 'checkout', '--', 'README.md');

// Meanwhile someone else pushes an unrelated change.
cwrite(other, 'reports/note.md', 'x\n');
git(other, 'add', '-A');
git(other, 'commit', '--quiet', '-m', 'unrelated');
git(other, 'push', '--quiet', 'origin', 'main');
r = save(clone, 'editor', `Before Breakfast No. ${n}: Test story`);
ok('the Editor can save a draft even though main moved on', r.status === 0 && onMain(`content/issues/${pad(n)}.json`) && onMain('reports/note.md'), r.stdout + r.stderr);
ok('…and the draft is still not published on main', !onMain(`content/published/${pad(n)}.json`));

// The fact-checker corrects and releases while the story file is also changed on main: must not overwrite.
git(other, 'pull', '--quiet');
const theirs = JSON.parse(readFileSync(join(other, `content/issues/${pad(n)}.json`), 'utf8'));
cwrite(other, `content/issues/${pad(n)}.json`, { ...theirs, teaser: 'Edited by Carl on his phone.' });
git(other, 'add', '-A');
git(other, 'commit', '--quiet', '-m', 'Carl edits the story');
git(other, 'push', '--quiet', 'origin', 'main');
cwrite(clone, `content/issues/${pad(n)}.json`, { ...draft(n, last), teaser: 'Edited by the fact-checker.' });
cwrite(clone, checkFile(n), verdict(n, 'fixed', { changes: [{ where: 'teaser', before: 'a', after: 'b', why: 'test' }] }));
r = save(clone, 'fact-checker', `Fact-check No. ${n}: fixed`);
ok('a save never overwrites someone else\'s change to the same file', r.status !== 0 && !onMain(checkFile(n)), r.stdout + r.stderr);

// Redo on top of theirs, as the message tells the agent to.
git(clone, 'fetch', '--quiet', 'origin', 'main');
git(clone, 'checkout', '--quiet', 'origin/main', '--', `content/issues/${pad(n)}.json`);
git(clone, 'reset', '--quiet');
cwrite(clone, checkFile(n), verdict(n, 'pass'));
r = save(clone, 'fact-checker', `Fact-check No. ${n}: pass`);
ok('the fact-checker can release a story', r.status === 0 && onMain(checkFile(n)) && onMain(`content/published/${pad(n)}.json`), r.stdout + r.stderr);

rmSync(scratch, { recursive: true, force: true });
rmSync(work, { recursive: true, force: true });
console.log(failed ? `\n✗ ${failed} test(s) failed` : '\n✓ All gate tests passed');
process.exit(failed ? 1 : 0);
