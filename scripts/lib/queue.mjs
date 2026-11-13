// Carl's queue: everything waiting for him, as one ranked list.
// Used by scripts/desk.mjs (the desk and the status page) and scripts/ask-carl.mjs.
//
// What goes in it: open needs-carl issues (raised by agents with ask-carl.mjs),
// open release tickets, open pull requests, answers from agents to Carl's requests,
// the newest video if under two days
// old, support drafts waiting, and a marketing brief or weekly report under two
// days old.
//
// The order: anything blocking an agent or readers first, then anything with a
// deadline (soonest first), then fewest minutes. Items marked optional go last.
import { addDays, daysBetween, ukOf } from './dates.mjs';
import { trusted } from './github.mjs';

/** Who can ask Carl for something, and how each is named to him. */
export const ASKERS = {
  editor: 'the Editor',
  'fact-checker': 'the fact-checker',
  producer: 'the Producer',
  analyst: 'the Analyst',
  marketing: 'Marketing',
  developer: 'the Developer',
  support: 'Support',
  desk: 'the desk',
  claude: 'Claude',
};

// A request's details travel in a hidden comment at the top of its issue, so the
// desk never has to read them back out of prose. ">" and "<" are escaped so that
// nothing typed in a request can end the comment early.
const ASK = /<!-- curiouser:ask (\{.*?\}) -->/;
export const askMarker = (meta) =>
  `<!-- curiouser:ask ${JSON.stringify(meta).replace(/>/g, '\\u003e').replace(/</g, '\\u003c')} -->`;
export function parseAsk(body) {
  const m = ASK.exec(body ?? '');
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}
/**
 * Agents Carl can ask for something: an issue labelled for-<agent>, usually opened
 * by Fenton for him. The Editor takes no requests: its prompt is Carl's to change.
 */
export const TEAM = {
  'fact-checker': 'the fact-checker',
  producer: 'the Producer',
  marketing: 'Marketing',
  analyst: 'the Analyst',
  developer: 'the Developer',
  support: 'Support',
};
export const requestLabel = (agent) => `for-${agent}`;
/** Which agent a request is for, from its for-<agent> label, or null. */
export function requestAgent(issue) {
  const name = (issue?.labels ?? []).map((l) => l?.name ?? l).find((n) => /^for-/.test(n) && TEAM[n.slice(4)]);
  return name ? name.slice(4) : null;
}
/**
 * Where a request stands. Agents comment as Carl's own account, with AGENT_MARK;
 * Carl's comments have no mark. Whoever spoke last decides: the agent (answered,
 * so it's Carl's turn) or Carl (waiting for the agent).
 */
export function requestState(comments) {
  const last = (comments ?? []).filter((c) => c.author_association === 'OWNER').at(-1);
  return last && (last.body ?? '').includes(AGENT_MARK) ? { answered: true, at: last.created_at } : { answered: false, at: null };
}

/** Any comment an agent leaves on a needs-carl issue carries this, so it is never mistaken for Carl's answer. */
export const AGENT_MARK = '<!-- curiouser:agent -->';
export const isCarlsAnswer = (comment) => comment?.author_association === 'OWNER' && !(comment.body ?? '').includes(AGENT_MARK);
export const sameTitle = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();
const clean = (t) => String(t ?? '').replace(/^\[Rehearsal\]\s*/, '').replace(/\s+/g, ' ').trim();
const sentence = (s) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

// How long each kind of item takes, in minutes, and the one step on a phone.
const TICKET = {
  unchecked: { minutes: 3, blocks: "readers can't see today's story", how: 'Read the story in the ticket. To publish it, close the ticket as completed. To keep it back, do nothing.' },
  held: { minutes: 2, blocks: "readers see yesterday's story", how: "Read why in the ticket, then close it. Closing doesn't publish it." },
  missing: { minutes: 1, blocks: "readers see yesterday's story", how: "Nothing, or in the Claude app open Scheduled, choose Curiouser: Before Breakfast story and tap Run now." },
};

/**
 * @param g what the desk gathered: tickets, needs (needs-carl issues), pulls,
 *          video, support, report, brief (file names), problems (released stories
 *          with problems the fact-checker couldn't fix), and uk (today, UK).
 */
export function buildQueue(g) {
  const { uk } = g;
  const items = [];
  const add = (item) => items.push({ blocks: null, by: null, optional: false, from: null, url: null, number: null, created: null, ...item });

  for (const t of g.tickets ?? []) {
    const k = TICKET[t.kind];
    if (k) add({ kind: `ticket-${t.kind}`, title: clean(t.title), ...k, from: 'desk', url: t.url, number: t.number });
  }

  for (const i of g.needs ?? []) {
    if (!trusted(i)) continue;
    const m = parseAsk(i.body) ?? {};
    add({
      kind: 'ask',
      title: clean(i.title),
      minutes: Number.isInteger(m.minutes) && m.minutes > 0 ? m.minutes : 5,
      blocks: m.blocks || null,
      by: /^\d{4}-\d{2}-\d{2}$/.test(m.by ?? '') ? m.by : null,
      optional: Boolean(m.optional),
      from: m.from ?? null,
      how: m.how ? sentence(m.how) : 'Read it, then answer.',
      url: i.html_url,
      number: i.number,
      created: i.created_at,
    });
  }

  // An agent has answered one of Carl's requests: his turn to read it.
  for (const r of g.requests ?? []) {
    if (!r.answered || !TEAM[r.agent]) continue;
    const who = TEAM[r.agent];
    add({
      kind: 'answer',
      title: `${who.charAt(0).toUpperCase()}${who.slice(1)} answered: ${clean(r.title)}`,
      minutes: 1,
      how: 'Read the answer on the issue, then close it, or reply to ask more.',
      from: r.agent,
      url: r.url,
      number: r.number,
      created: r.at,
    });
  }

  for (const s of g.problems ?? []) {
    add({
      kind: 'problem',
      title: `No. ${s.id} has ${s.check.problems.length === 1 ? 'a problem' : `${s.check.problems.length} problems`} the fact-checker couldn't fix`,
      minutes: 3,
      how: `Read the check, then say to Claude: "Fix No. ${s.id} using the fact-checker's notes."`,
      from: 'fact-checker',
      url: s.checkUrl,
    });
  }

  for (const p of g.pulls ?? []) {
    const ours = trusted(p);
    add({
      kind: 'pull',
      title: ours ? `Pull request #${p.number}: ${p.title}` : `Pull request #${p.number}, from someone outside the team`,
      minutes: ours ? 5 : 2,
      how: ours
        ? 'Open it, look at the pictures, then tap Merge to send it to phones, or comment.'
        : "Look before anything else, and never merge what you didn't ask for.",
      from: ours ? 'developer' : null,
      url: p.html_url,
      number: p.number,
      created: p.created_at,
    });
  }

  if (g.video && g.now - new Date(g.video.made) < 2 * 86400000) {
    const v = g.video;
    add({
      kind: 'video',
      title: `Post the video for No. ${v.id}`,
      minutes: 3,
      by: addDays(ukOf(v.made).date, 2),
      how: [
        "Download it from the desk, watch it, then post it yourself with the caption at the bottom of the desk. Switch on the app's AI label.",
        ...(v.warnings ?? []).map((w) => `Made with a stand-in: ${w}`),
      ].join(' '),
      from: 'producer',
      url: v.url,
    });
  }

  if (g.support?.waiting) {
    add({
      kind: 'support',
      title: `Send ${g.support.waiting === 1 ? 'a support reply' : `${g.support.waiting} support replies`}`,
      minutes: 2 * g.support.waiting,
      by: uk.date,
      how: "Open the Curiouser mailbox's Drafts folder, edit each reply and send it.",
      from: 'support',
    });
  }

  for (const [kind, file, who, minutes, what] of [
    ['brief', g.brief, 'marketing', 2, 'the Marketing brief'],
    ['report', g.report, 'analyst', 3, 'the weekly report'],
  ]) {
    if (!file) continue;
    const date = file.slice(0, 10);
    if (daysBetween(date, uk.date) >= 2) continue;
    add({ kind, title: `Read ${what}`, minutes, how: 'One phone screen.', from: who, url: g.urls?.[kind] ?? null, created: `${date}T12:00:00Z` });
  }

  return rank(items);
}

export function rank(items) {
  const key = (i) => [i.optional ? 1 : 0, i.blocks ? 0 : 1, i.by ?? '9999-12-31', i.minutes, i.created ?? '9999', i.number ?? 0];
  const cmp = (a, b) => {
    const [x, y] = [key(a), key(b)];
    for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1;
    return 0;
  };
  return [...items].sort(cmp).map((i, n) => ({ rank: n + 1, ...i }));
}

export const totalMinutes = (items) => items.reduce((sum, i) => sum + i.minutes, 0);
