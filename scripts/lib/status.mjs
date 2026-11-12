// The status page: status.md, written to be read aloud by Fenton (under 200
// words, no tables, no links), and status.json with the same facts in full.
// scripts/desk.mjs writes both each time the desk updates and pushes them to
// the `status` branch.
import { fmtDate, dueWords } from './dates.mjs';
import { totalMinutes } from './queue.mjs';

export const STATUS_WORDS = 200;
const words = (s) => s.split(/\s+/).filter(Boolean).length;
const mins = (n) => (n === 1 ? '1 minute' : `${n} minutes`);
const things = (n) => (n === 1 ? '1 thing' : `${n} things`);
const andList = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const noDot = (s) => s.replace(/[.\s]+$/, '');

/** Markdown to plain words: no links, emphasis or emoji. */
export const plain = (s) =>
  String(s ?? '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\p{Extended_Pictographic}️?/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

function agentsLine(health) {
  const fails = health.filter((h) => h.state === 'fail');
  const waiting = health.filter((h) => h.state === 'not-due').map((h) => h.agent);
  const parts = [];
  if (fails.length) {
    parts.push(`Agents: ${fails.length === 1 ? 'one problem' : `${fails.length} problems`}.`);
    for (const f of fails) parts.push(`${f.agent}: ${f.text}`);
    if (health.some((h) => h.state === 'ok')) parts.push('Everything else that was due is fine.');
  } else {
    parts.push(health.some((h) => h.state === 'ok') ? 'Agents: everything that was due is fine.' : 'Agents: nothing was due yet.');
  }
  if (waiting.length) parts.push(`Not due yet: ${andList(waiting)}.`);
  return parts.join(' ');
}

function itemLine(i, today, withHow) {
  const title = plain(i.title);
  const bits = [/[?!]$/.test(title) ? `${i.rank}. ${title}` : `${i.rank}. ${noDot(title)}.`, `${mins(i.minutes)}.`];
  if (i.blocks) bits.push(`Blocks: ${noDot(plain(i.blocks))}.`);
  if (i.by) bits.push(`${dueWords(i.by, today).replace(/^./, (c) => c.toUpperCase())}.`);
  if (i.optional) bits.push('Optional.');
  if (withHow) bits.push(plain(i.how));
  if (i.number) bits.push(`Issue ${i.number}.`);
  return bits.join(' ');
}

export function weekLine(w) {
  const n = (count, one, many = `${one}s`) => (count === 0 ? `no ${many}` : count === 1 ? `1 ${one}` : `${count} ${many}`);
  return [
    `This week so far: ${n(w.released, 'story', 'stories')} released, ${w.held ? `${w.held} held` : 'none held'}`,
    `${n(w.checks, 'fact-check')}, ${w.corrected} with corrections`,
    n(w.videos, 'video'),
    `${n(w.prsOpened, 'pull request')} opened, ${w.prsMerged ? `${w.prsMerged} merged` : 'none merged'}`,
    `${n(w.failedRuns, 'failed run')}.`,
  ].join('; ');
}

export function renderStatus({ uk, now, rehearsal, fenton, health, queue, today, week, deskUrl }) {
  const head = [
    '# Curiouser status',
    '',
    ...(rehearsal ? ['Rehearsal: practice data, not the real desk.', ''] : []),
    `Written ${fmtDate(uk.date)} at ${uk.clock}, UK time.`,
    '',
    `Fenton: ${fenton.line}`,
    '',
    agentsLine(health),
    '',
    `Today's story: ${plain(today)}`,
    '',
  ];
  const tail = ['', weekLine(week)];
  const total = totalMinutes(queue);

  // As many items as fit under the word limit: the top three with their steps, then titles only.
  const build = (shown, howFor) => {
    const lines = [...head];
    if (!queue.length) lines.push('Waiting for you: nothing.');
    else {
      lines.push(`Waiting for you: ${things(queue.length)}, about ${mins(total)}. In order:`, '');
      for (const i of queue.slice(0, shown)) lines.push(itemLine(i, uk.date, i.rank <= howFor));
      const rest = queue.slice(shown);
      if (rest.length) lines.push('', `And ${things(rest.length)} more, about ${mins(totalMinutes(rest))}, on the desk.`);
    }
    return [...lines, ...tail].join('\n') + '\n';
  };
  // Fenton reads the top three with their steps, so those come first; titles of
  // the fourth and fifth only if there is room.
  const tries = [[5, 3], [4, 3], [3, 3], [3, 2], [3, 1], [3, 0], [2, 0], [1, 0]]
    .map(([shown, howFor]) => [Math.min(shown, queue.length), Math.min(howFor, shown, queue.length)]);
  let md = '';
  for (const [shown, howFor] of tries) {
    md = build(shown, howFor);
    if (words(md) < STATUS_WORDS) break;
  }

  const json = {
    written: now.toISOString(),
    writtenUK: `${fmtDate(uk.date)}, ${uk.clock}`,
    rehearsal,
    fenton,
    today: plain(today),
    health,
    queue: { count: queue.length, minutes: total, items: queue },
    week,
    desk: deskUrl,
  };
  return { md, json: JSON.stringify(json, null, 2) + '\n', words: words(md) };
}
