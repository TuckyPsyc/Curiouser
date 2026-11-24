// Shared view of what's in content/: every story, its fact-check verdict, and
// whether readers can see it. Used by build-feed, release, desk and stats.
//
// The rule (DECISIONS.md, D-012): a story reaches readers only if
// content/checks/NNNN.json exists with a releasing verdict. A story with no
// check file is a draft. Nothing else can publish it.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// CURIOUSER_ROOT lets the tests run against a scratch copy of the repo.
export const root = process.env.CURIOUSER_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const issuesDir = join(root, 'content', 'issues');
export const checksDir = join(root, 'content', 'checks');

/** pass: checked, nothing to change. fixed: checked, small verified corrections made.
 *  held: serious problems, kept back. released-unchecked: published by Carl (or at launch) without a completed check. */
export const VERDICTS = ['pass', 'fixed', 'held', 'released-unchecked'];
export const RELEASING = new Set(['pass', 'fixed', 'released-unchecked']);
export const CHECKERS = ['fact-checker', 'editor-in-chief', 'launch'];

// Issues 1–5 were the launch set. From issue 6, topics follow CYCLE in order:
// issue 6 is Science, issue 7 History, and so on, repeating every 15 issues.
export const LAUNCH = ['History', 'Psychology', 'Literature', 'Self-Improvement', "Gentleman's Pursuits"];
export const CYCLE = [
  'Science', 'History', 'Philosophy', 'Psychology', 'Nature', 'Literature', 'Economics',
  'Self-Improvement', 'Art & Music', 'Mathematics', "Gentleman's Pursuits", 'Society',
  'Technology', 'Language', 'Health & Medicine',
];
export const topicFor = (id) => (id <= LAUNCH.length ? LAUNCH[id - 1] : CYCLE[(id - LAUNCH.length - 1) % CYCLE.length]);

export const pad = (id) => String(id).padStart(4, '0');
export const checkPath = (id) => join(checksDir, id === 0 ? 'start-here.json' : `${pad(id)}.json`);

export function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Every check file, keyed by issue id (0 is Start here). Unreadable files are reported, not thrown. */
export function loadChecks() {
  const checks = new Map();
  const problems = [];
  if (!existsSync(checksDir)) return { checks, problems };
  for (const file of readdirSync(checksDir).sort()) {
    const m = /^(\d{4}|start-here)\.json$/.exec(file);
    if (!m) continue;
    const id = m[1] === 'start-here' ? 0 : Number(m[1]);
    try {
      checks.set(id, readJSON(join(checksDir, file)));
    } catch (e) {
      problems.push(`checks/${file}: invalid JSON (${e.message})`);
    }
  }
  return { checks, problems };
}

/** 'released' | 'held' | 'draft' for a story id. */
export function statusOf(id, checks) {
  const c = checks.get(id);
  if (!c) return 'draft';
  if (RELEASING.has(c.verdict)) return 'released';
  return c.verdict === 'held' ? 'held' : 'draft';
}

/** Light summary of every story on disk, oldest first, with its status. */
export function loadStories() {
  const { checks } = loadChecks();
  const stories = [];
  for (const file of readdirSync(issuesDir).filter((f) => /^\d{4}\.json$/.test(f)).sort()) {
    try {
      const issue = readJSON(join(issuesDir, file));
      stories.push({
        id: issue.id,
        date: issue.date,
        topic: issue.topic,
        title: issue.title,
        concept: issue.concept,
        status: statusOf(issue.id, checks),
        check: checks.get(issue.id) ?? null,
        issue,
      });
    } catch {
      // build-feed reports unreadable stories; other scripts just skip them.
    }
  }
  return { stories, checks };
}

/** Today's date in the UK, YYYY-MM-DD, and the UK clock as minutes past midnight. */
export function londonNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    clock: `${parts.hour}:${parts.minute}`,
  };
}

// ---------- The spare ----------
// One checked story kept in reserve for a morning when the day's story is
// missing or held (DECISIONS.md, D-021). The Editor writes it to
// content/spare/spare.json, with no id or date. The fact-checker checks it and
// writes content/checks/spare.json, which records the spare's sha256 as checked,
// so a spare changed after its check is unchecked again. scripts/spare.mjs puts
// it out as the next numbered story.
export const spareDir = join(root, 'content', 'spare');
export const sparePath = join(spareDir, 'spare.json');
export const spareCheckPath = join(checksDir, 'spare.json');
export const SPARE_VERDICTS = ['pass', 'fixed', 'held'];

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** The spare and its verdict. status: 'none' | 'unchecked' | 'changed' | 'held' | 'checked'. */
export function loadSpare() {
  if (!existsSync(sparePath)) return { status: 'none', spare: null, check: null, sha: null, problem: null };
  const raw = readFileSync(sparePath);
  const sha = sha256(raw);
  let spare = null;
  let problem = null;
  try {
    spare = JSON.parse(raw.toString('utf8'));
  } catch (e) {
    problem = `spare/spare.json: invalid JSON (${e.message})`;
  }
  let check = null;
  if (existsSync(spareCheckPath)) {
    try {
      check = readJSON(spareCheckPath);
    } catch (e) {
      problem ??= `checks/spare.json: invalid JSON (${e.message})`;
    }
  }
  let status = 'unchecked';
  if (check && check.sha256 !== sha) status = check.sha256 ? 'changed' : 'unchecked';
  else if (check?.verdict === 'held') status = 'held';
  else if (check && RELEASING.has(check.verdict) && check.by === 'fact-checker') status = 'checked';
  return { status, spare, check, sha, problem };
}
