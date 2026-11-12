#!/usr/bin/env node
// Puts a request on Carl's queue: one GitHub issue labelled needs-carl. Agents run
// this instead of leaving a request in a report or brief, where it gets missed.
//
// Ask:
//   node scripts/ask-carl.mjs --from <agent> --title "…" --why "…" --minutes N --how "…"
//        [--blocks "what can't happen until he does it"] [--by YYYY-MM-DD] [--optional] [--rehearsal]
// Read Carl's answers to your own requests:
//   node scripts/ask-carl.mjs --answers --from <agent> [--days 8] [--json]
//
// One request, one issue. If an open needs-carl issue already has the same title,
// nothing new is opened. Carl answers by commenting and closing the issue.
//
// Carl is assigned by the desk (scripts/desk.mjs), not here. Agents act as Carl's
// own GitHub account, and GitHub never notifies anyone of their own actions, so an
// agent assigning him would leave his phone silent. The desk runs as
// github-actions within about a minute of the issue opening, and its assignment
// is what notifies him (DECISIONS.md, D-020).
//
// --rehearsal checks for a duplicate as usual, then prints the issue it would open
// and writes nothing to GitHub, so nobody is notified.
//
// The repository is public: never put a reader's name or words, an email address
// or a secret in a request.
import { github, trusted } from './lib/github.mjs';
import { ASKERS, askMarker, parseAsk, sameTitle, isCarlsAnswer } from './lib/queue.mjs';
import { fmtDate, ukOf } from './lib/dates.mjs';

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
const repo = process.env.GITHUB_REPOSITORY || 'TuckyPsyc/curiouser';
const api = github({ useGh: !process.env.GITHUB_TOKEN });
const LABEL = 'needs-carl';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const usage = () => {
  console.error(
    [
      'Usage:',
      '  node scripts/ask-carl.mjs --from <agent> --title "…" --why "…" --minutes N --how "…" [--blocks "…"] [--by YYYY-MM-DD] [--optional] [--rehearsal]',
      '  node scripts/ask-carl.mjs --answers --from <agent> [--days 8] [--json]',
      `Agents: ${Object.keys(ASKERS).join(', ')}`,
    ].join('\n'),
  );
  process.exit(2);
};
const refuse = (msg) => {
  console.error(`✗ Not asked. ${msg}`);
  process.exit(2);
};

const from = opt('--from');
if (!from || !ASKERS[from]) usage();

if (flag('--answers')) await answers();
else await ask();

async function ask() {
  const rehearsal = flag('--rehearsal');
  const title = (opt('--title') ?? '').replace(/\s+/g, ' ').trim();
  const why = (opt('--why') ?? '').trim();
  const how = (opt('--how') ?? '').trim();
  const blocks = (opt('--blocks') ?? '').trim() || null;
  const by = opt('--by') ?? null;
  const minutes = Number(opt('--minutes'));
  const optional = flag('--optional');

  if (!title || !why || !how || !opt('--minutes')) usage();
  if (title.length > 100) refuse('Keep the title under 100 characters: it is read aloud.');
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) refuse('--minutes must be a whole number from 1 to 240.');
  if (by && (!/^\d{4}-\d{2}-\d{2}$/.test(by) || Number.isNaN(Date.parse(by)))) refuse('--by must be a date like 2026-11-20.');
  for (const [name, text] of Object.entries({ title, why, how, blocks: blocks ?? '' })) {
    if (text.length > 500) refuse(`--${name} is too long. Say it in a sentence or two.`);
    // The repository is public (D-001). An address in a request would be published.
    if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(text)) refuse(`--${name} contains an email address. The repository is public: leave it out.`);
  }

  // A request already waiting with the same title is not asked twice.
  let open = [];
  try {
    open = await api('GET', `/repos/${repo}/issues?labels=${LABEL}&state=open&per_page=100`);
  } catch (e) {
    if (!rehearsal) {
      console.error(`✗ Could not reach GitHub to check for the same request: ${e.message.split('\n')[0]}`);
      process.exit(1);
    }
    console.log(`(Rehearsal: couldn't check for the same request: ${e.message.split('\n')[0]})`);
  }
  const same = open.find((i) => !i.pull_request && sameTitle(i.title, title));
  if (same) {
    console.log(`Already asked: #${same.number} ${same.html_url ?? ''}. Nothing new opened.`);
    return;
  }

  const meta = { from, minutes, why, how, blocks, by, optional };
  const who = ASKERS[from];
  const facts = [
    `**From:** ${cap(who)}`,
    `**About ${minutes === 1 ? '1 minute' : `${minutes} minutes`}**`,
    blocks && `**Blocks:** ${blocks}`,
    by && `**Due:** ${fmtDate(by)}`,
    optional && '*Optional*',
  ].filter(Boolean);
  const body = [
    askMarker(meta),
    facts.join(' · '),
    '',
    `**Why:** ${why}`,
    '',
    `**What to do:** ${how}`,
    '',
    `**To answer:** comment below, then close this issue. Close it as *not planned* to say no.${
      ['desk', 'claude'].includes(from) ? '' : ` ${cap(who)} reads your answer on its next run.`
    }`,
  ].join('\n');

  if (rehearsal) {
    console.log(`Rehearsal: nothing written to GitHub, nobody notified. Would open:\n\nTitle: ${title}\nLabel: ${LABEL}\n\n${body}`);
    return;
  }

  // Make sure the label exists, so the issue is labelled even on a fresh repository.
  try {
    await api('POST', `/repos/${repo}/labels`, { name: LABEL, color: 'D93F0B', description: 'Waiting for Carl' });
  } catch (e) {
    if (!/already_exists|HTTP 422/.test(e.message)) console.log(`(could not check the ${LABEL} label: ${e.message.split('\n')[0].slice(0, 160)})`);
  }
  let made;
  try {
    made = await api('POST', `/repos/${repo}/issues`, { title, body, labels: [LABEL] });
  } catch (e) {
    console.error(`✗ Could not open the request: ${e.message.split('\n')[0]}`);
    process.exit(1);
  }
  console.log(`✓ Asked Carl: #${made.number} ${made.html_url}`);
}

async function answers() {
  const days = Number(opt('--days') ?? 8);
  const since = new Date(Date.now() - days * 86400000).toISOString();
  let issues;
  try {
    issues = await api('GET', `/repos/${repo}/issues?labels=${LABEL}&state=all&since=${encodeURIComponent(since)}&sort=updated&per_page=100`);
  } catch (e) {
    console.error(`✗ Could not read the requests: ${e.message.split('\n')[0]}`);
    process.exit(1);
  }
  const mine = issues.filter((i) => !i.pull_request && trusted(i) && parseAsk(i.body)?.from === from);
  const out = [];
  for (const i of mine) {
    const comments = i.comments ? await api('GET', `/repos/${repo}/issues/${i.number}/comments?per_page=100`) : [];
    out.push({
      number: i.number,
      title: i.title,
      state: i.state,
      closedAs: i.state === 'closed' ? (i.state_reason === 'not_planned' ? 'not planned' : 'completed') : null,
      closedAt: i.closed_at ?? null,
      answers: comments.filter(isCarlsAnswer).map((c) => ({ at: c.created_at, text: c.body.trim() })),
    });
  }
  if (flag('--json')) return console.log(JSON.stringify(out, null, 2));
  if (!out.length) return console.log(`No requests from ${ASKERS[from]} updated in the last ${days} days.`);
  console.log(`Carl's answers to ${ASKERS[from]}'s requests updated in the last ${days} days. Only Carl's own comments are shown.\n`);
  for (const r of out) {
    const when = r.closedAt ? ` on ${fmtDate(ukOf(r.closedAt).date)}` : '';
    console.log(`#${r.number} "${r.title}": ${r.state === 'open' ? 'still open' : `closed as ${r.closedAs}${when}`}.`);
    if (!r.answers.length) console.log('  No comment from Carl.');
    for (const a of r.answers) {
      const t = ukOf(a.at);
      console.log(`  Carl, ${fmtDate(t.date)} ${t.clock}: ${a.text.replace(/\s*\n\s*/g, ' ')}`);
    }
  }
}
