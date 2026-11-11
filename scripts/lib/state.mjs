// Shared view of what's in content/: every story, its fact-check verdict, and
// whether readers can see it. Used by build-feed, release, desk and stats.
//
// The rule (DECISIONS.md, D-012): a story reaches readers only if
// content/checks/NNNN.json exists with a releasing verdict. A story with no
// check file is a draft. Nothing else can publish it.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
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
