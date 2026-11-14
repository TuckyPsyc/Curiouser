#!/usr/bin/env node
// The clerk: carries Carl's decisions from Fenton's Ledger to GitHub.
//
// Fenton (Carl's chief of staff) talks to Carl in an ordinary Claude chat, which
// can't write to GitHub. So he writes each decision as one line in a Claude doc,
// Fenton's Ledger, and the Clerk agent copies the "To do" lines into a file and
// runs this script twice a day (agents/clerk.md, DECISIONS.md D-020).
//
//   node scripts/clerk.mjs <file-of-lines> [--dry-run]
//
// One line per decision, each starting with the date:
//   2026-11-14 · Close #12 — Carl's words        comment with his words, then close (done)
//   2026-11-14 · No #12 — Carl's words           comment, then close as not planned
//   2026-11-14 · Reply #12 — Carl's words        comment only; the issue stays open
//   2026-11-14 · Ask developer — Title — words   open a request for that agent (for-developer)
//   2026-11-14 · Ask developer now — Title — words   …and ask the Clerk to start that agent's run
//
// The rules are here, in code, not in anyone's instructions: the clerk only ever
// touches Carl's queue (needs-carl), requests to agents (for-<agent>) and, for a
// Reply, the results issue ("How the posts did"). Never a release ticket (closing
// one publishes a story unchecked), a pull request or the desk. Every write carries
// a hidden mark made from the line, so a line applied twice changes nothing.
//
// Prints JSON: one result per line, for the Clerk to write back into the ledger.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { github, trusted } from './lib/github.mjs';
import { TEAM, requestAgent, requestLabel } from './lib/queue.mjs';
import { fmtDate } from './lib/dates.mjs';

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const dryRun = argv.includes('--dry-run');
const repo = process.env.GITHUB_REPOSITORY || 'TuckyPsyc/curiouser';
const api = github({ useGh: !process.env.GITHUB_TOKEN });
const RESULTS_TITLE = 'How the posts did';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

if (!file) {
  console.error('Usage: node scripts/clerk.mjs <file-of-ledger-lines> [--dry-run]');
  process.exit(2);
}

const DASH = '\\s+(?:—|–|--|\\|)\\s+';
const DATE = '(\\d{4}-\\d{2}-\\d{2})\\s*(?:·|\\||-|–|—|:)?\\s*';
const ISSUE_LINE = new RegExp(`^${DATE}(close|no|reply)\\s+#(\\d+)(?:${DASH}|\\s*:\\s+)(.+)$`, 'i');
const ASK_LINE = new RegExp(`^${DATE}ask\\s+(?:the\\s+)?([a-z-]+)(\\s+now)?${DASH}(.+?)${DASH}(.+)$`, 'i');
const FORMS =
  'Write it as "YYYY-MM-DD · Close #N — Carl\'s words" (or No, Reply), or "YYYY-MM-DD · Ask <agent> — Title — Carl\'s words" (add "now" after the agent to run it today).';

/** One ledger line as an action, or { error }. */
export function parseLine(raw) {
  const line = raw.replace(/^\s*(?:[-*•]|\d+\.)\s+/, '').replace(/\s+/g, ' ').trim();
  let m = ISSUE_LINE.exec(line);
  if (m) return { line, date: m[1], verb: m[2].toLowerCase(), issue: Number(m[3]), words: m[4].trim() };
  m = ASK_LINE.exec(line);
  if (m) return { line, date: m[1], verb: 'ask', agent: m[2].toLowerCase(), now: Boolean(m[3]), title: m[4].trim(), words: m[5].trim() };
  return { line, error: `Couldn't read this line. ${FORMS}` };
}

const markOf = (line) => `<!-- ledger:${createHash('sha256').update(line).digest('hex').slice(0, 16)} -->`;
const labels = (i) => (i.labels ?? []).map((l) => l?.name ?? l);
const dateOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

async function apply(a) {
  if (a.error) return { line: a.line, ok: false, message: a.error };
  const refuse = (message) => ({ line: a.line, ok: false, message });
  if (!dateOk(a.date)) return refuse(`"${a.date}" isn't a date. ${FORMS}`);
  if (!a.words || a.words.length > 1500) return refuse("Carl's words are missing or too long (1,500 characters at most).");
  // The repository is public (D-001).
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(`${a.title ?? ''} ${a.words}`)) return refuse('It contains an email address, and the repository is public. Leave it out.');
  const mark = markOf(a.line);
  const when = fmtDate(a.date);

  if (a.verb === 'ask') {
    if (a.agent === 'editor') return refuse('The Editor takes no requests: its instructions are its scheduled task, which only Carl changes.');
    if (!TEAM[a.agent]) return refuse(`There's no agent called "${a.agent}". Use one of: ${Object.keys(TEAM).join(', ')}.`);
    if (a.title.length > 100) return refuse('The title is over 100 characters. Say it in a few words.');
    const label = requestLabel(a.agent);
    const known = await api('GET', `/repos/${repo}/issues?labels=${label}&state=all&per_page=100`);
    const same =
      known.find((i) => (i.body ?? '').includes(mark)) ??
      known.find((i) => i.state === 'open' && trusted(i) && i.title.trim().toLowerCase() === a.title.toLowerCase());
    const fire = a.now ? { agent: a.agent, task: `Curiouser: ${cap(a.agent === 'fact-checker' ? 'Fact-checker' : a.agent)}`, text: 'Requests only' } : null;
    if (same) return { line: a.line, ok: true, action: 'already asked', issue: same.number, url: same.html_url, message: `Already with ${TEAM[a.agent]}: #${same.number}.`, fire };
    const body = `${a.words}\n\nAsked by Carl through Fenton, ${when}.\n\n${mark}`;
    if (dryRun) return { line: a.line, ok: true, action: 'would ask', message: `Would ask ${TEAM[a.agent]}: "${a.title}".`, fire };
    const made = await api('POST', `/repos/${repo}/issues`, { title: a.title, body, labels: [label] });
    return { line: a.line, ok: true, action: 'asked', issue: made.number, url: made.html_url, message: `Asked ${TEAM[a.agent]}: #${made.number}.`, fire };
  }

  let issue;
  try {
    issue = await api('GET', `/repos/${repo}/issues/${a.issue}`);
  } catch {
    return refuse(`There's no issue #${a.issue}.`);
  }
  if (issue.pull_request) return refuse(`#${a.issue} is a pull request. Carl merges or comments on those himself.`);
  const ls = labels(issue);
  if (ls.includes('release-ticket')) return refuse(`#${a.issue} is a release ticket. Only Carl's own tap may close one, because closing it publishes the story.`);
  if (ls.includes('desk')) return refuse(`#${a.issue} is the editor's desk. Nothing is recorded there.`);
  if (!trusted(issue)) return refuse(`#${a.issue} wasn't opened by Carl or the team. The clerk doesn't touch it.`);
  const isResults = issue.title.trim() === RESULTS_TITLE;
  const isQueue = ls.includes('needs-carl') || Boolean(requestAgent(issue));
  if (!isQueue && !(isResults && a.verb === 'reply')) {
    return refuse(
      isResults
        ? `#${a.issue} is where post numbers go. Use "Reply #${a.issue}"; it stays open.`
        : `#${a.issue} isn't on Carl's queue or a request to an agent, so the clerk can't record anything there.`,
    );
  }
  if (issue.state !== 'open') return { line: a.line, ok: true, action: 'already closed', issue: a.issue, url: issue.html_url, message: `#${a.issue} was already closed. Nothing changed.` };

  const comments = issue.comments ? await api('GET', `/repos/${repo}/issues/${a.issue}/comments?per_page=100`) : [];
  const done = comments.some((c) => (c.body ?? '').includes(mark));
  const text =
    a.verb === 'reply'
      ? `Carl, through Fenton, ${when}: ${a.words}\n\n${mark}`
      : `Carl's decision, recorded by Fenton on ${when}: ${a.words}\n\n${mark}`;
  const close = a.verb === 'reply' ? null : a.verb === 'no' ? 'not_planned' : 'completed';
  const what = a.verb === 'reply' ? `Replied on #${a.issue}.` : `${close === 'completed' ? 'Closed' : 'Closed as not planned'} #${a.issue}.`;
  if (dryRun) return { line: a.line, ok: true, action: 'would record', issue: a.issue, message: `Would record: ${what}` };
  if (!done) await api('POST', `/repos/${repo}/issues/${a.issue}/comments`, { body: text });
  if (close) await api('PATCH', `/repos/${repo}/issues/${a.issue}`, { state: 'closed', state_reason: close });
  return { line: a.line, ok: true, action: a.verb, issue: a.issue, url: issue.html_url, message: what };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const lines = readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !/^#/.test(l));
  const results = [];
  for (const raw of lines) {
    try {
      results.push(await apply(parseLine(raw)));
    } catch (e) {
      results.push({ line: raw, ok: false, message: `GitHub refused or couldn't be reached: ${e.message.split('\n')[0].slice(0, 200)}. Left for the next run.`, retry: true });
    }
  }
  // At most one "now" run per agent.
  const seen = new Set();
  for (const r of results) {
    if (!r.fire) continue;
    if (seen.has(r.fire.agent)) r.fire = null;
    else seen.add(r.fire.agent);
  }
  console.log(JSON.stringify({ dryRun, results }, null, 2));
}
