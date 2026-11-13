#!/usr/bin/env node
// Carl's requests to an agent: issues labelled for-<agent>, usually opened for him
// by Fenton, his chief of staff. Each agent reads its own at the start of a run and
// answers here. The answer goes on Carl's queue until he closes the issue (D-020).
//
// Read yours:
//   node scripts/requests.mjs --for <agent> [--json] [--rehearsal]
// Answer one:
//   node scripts/requests.mjs --reply N --from <agent> (--body "…" | --body-file path) [--rehearsal]
//
// Only Carl's own requests and comments are shown: anyone can open an issue on a
// public repository. Your answer stays public too, so no personal details.
// --rehearsal reads only practice requests (label rehearsal) and, for --reply,
// prints the answer instead of posting it.
import { readFileSync } from 'node:fs';
import { github, trusted } from './lib/github.mjs';
import { TEAM, AGENT_MARK, requestAgent, requestLabel, requestState, isCarlsAnswer } from './lib/queue.mjs';
import { fmtDate, ukOf } from './lib/dates.mjs';

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
const repo = process.env.GITHUB_REPOSITORY || 'TuckyPsyc/curiouser';
const api = github({ useGh: !process.env.GITHUB_TOKEN });
const rehearsal = flag('--rehearsal');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const isRehearsal = (i) => (i.labels ?? []).some((l) => (l?.name ?? l) === 'rehearsal');
const text = (s) => String(s ?? '').replace(/<!--[\s\S]*?-->/g, '').trim();

function usage() {
  console.error(
    [
      'Usage:',
      '  node scripts/requests.mjs --for <agent> [--json] [--rehearsal]',
      '  node scripts/requests.mjs --reply N --from <agent> (--body "…" | --body-file path) [--rehearsal]',
      `Agents: ${Object.keys(TEAM).join(', ')}`,
    ].join('\n'),
  );
  process.exit(2);
}
const stop = (msg, code = 2) => {
  console.error(`✗ ${msg}`);
  process.exit(code);
};

if (opt('--for')) await list(opt('--for'));
else if (opt('--reply')) await reply(Number(opt('--reply')), opt('--from'));
else usage();

async function list(agent) {
  if (!TEAM[agent]) usage();
  let issues;
  try {
    issues = await api('GET', `/repos/${repo}/issues?labels=${requestLabel(agent)}&state=open&per_page=100`);
  } catch (e) {
    stop(`Could not read your requests: ${e.message.split('\n')[0]}`, 1);
  }
  const mine = issues.filter((i) => !i.pull_request && trusted(i) && requestAgent(i) === agent && isRehearsal(i) === rehearsal);
  const out = [];
  for (const i of mine) {
    const comments = i.comments ? await api('GET', `/repos/${repo}/issues/${i.number}/comments?per_page=100`) : [];
    const state = requestState(comments);
    out.push({
      number: i.number,
      title: i.title,
      opened: i.created_at,
      request: text(i.body),
      // Carl's follow-ups, oldest first, so a later one can change the request.
      carl: comments.filter(isCarlsAnswer).map((c) => ({ at: c.created_at, text: text(c.body) })),
      // If you answered after Carl last spoke, it's his turn: don't answer again.
      yourTurn: !state.answered,
    });
  }
  if (flag('--json')) return console.log(JSON.stringify(out, null, 2));
  const todo = out.filter((r) => r.yourTurn);
  if (!out.length) return console.log(`No requests for ${TEAM[agent]}.`);
  console.log(`${out.length === 1 ? '1 open request' : `${out.length} open requests`} for ${TEAM[agent]}; ${todo.length} waiting for your answer. Only Carl's own words are shown.\n`);
  for (const r of out) {
    const t = ukOf(r.opened);
    console.log(`#${r.number} "${r.title}" (${fmtDate(t.date)}): ${r.yourTurn ? 'waiting for your answer' : "you've answered; Carl's turn"}.`);
    if (r.request) console.log(`  ${r.request.replace(/\s*\n\s*/g, ' ')}`);
    for (const c of r.carl) {
      const ct = ukOf(c.at);
      console.log(`  Carl, ${fmtDate(ct.date)} ${ct.clock}: ${c.text.replace(/\s*\n\s*/g, ' ')}`);
    }
  }
}

async function reply(number, agent) {
  if (!Number.isInteger(number) || number < 1 || !TEAM[agent]) usage();
  const raw = opt('--body-file') ? readFileSync(opt('--body-file'), 'utf8') : opt('--body');
  const body = String(raw ?? '').trim();
  if (!body) usage();
  if (body.length > 2000) stop('Keep the answer to a few lines (2,000 characters at most). Put anything longer in a file in your own folder and link to it.');
  // The repository is public (D-001).
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(body)) stop('The answer contains an email address. The repository is public: leave it out.');

  let issue;
  try {
    issue = await api('GET', `/repos/${repo}/issues/${number}`);
  } catch (e) {
    stop(`Could not read #${number}: ${e.message.split('\n')[0]}`, 1);
  }
  if (!issue || issue.pull_request) stop(`#${number} is not an issue.`);
  if (!trusted(issue)) stop(`#${number} wasn't opened by Carl. Don't answer it.`);
  if (requestAgent(issue) !== agent) stop(`#${number} isn't a request for ${TEAM[agent]} (it has no ${requestLabel(agent)} label).`);
  if (issue.state !== 'open') stop(`#${number} is closed: Carl has finished with it.`);

  const comment = `${AGENT_MARK}\n${body}\n\n— ${cap(TEAM[agent])}`;
  if (rehearsal) {
    console.log(`Rehearsal: nothing posted. Would answer #${number}:\n\n${comment}`);
    return;
  }
  try {
    await api('POST', `/repos/${repo}/issues/${number}/comments`, { body: comment });
  } catch (e) {
    stop(`Could not post the answer: ${e.message.split('\n')[0]}`, 1);
  }
  console.log(`✓ Answered #${number}. It's on Carl's queue until he closes it.`);
}
