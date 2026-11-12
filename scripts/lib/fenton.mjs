// Fenton's line for the morning: one dry remark, chosen by how things stand.
// It goes at the top of the status page and, signed "Fenton", in the desk's
// morning note. Plain text, no AI, nothing to pay for.
//
// The lines are colour, never information: none of them states a number, a name
// or a fact, so none can contradict the status page beneath it. The sarcasm is
// aimed at circumstances and the backlog, never at Carl.
import { isWeekend } from './dates.mjs';

export const LINES = {
  // Every check that was due passed, and nothing is waiting.
  clear: [
    'Nothing requires your attention. I checked twice, out of habit rather than doubt.',
    'The desk is clear, sir. I shall try not to get used to it.',
    'All in order. The agents appear to have behaved themselves, which I note without comment.',
    'Nothing waiting. A rare morning; I recommend enjoying it before something arrives.',
  ],
  // One to three things waiting.
  few: [
    "A short list this morning. Nothing a cup of tea won't see off.",
    "Only a little waiting for you. I've put it in a sensible order, as is my custom.",
    "A modest pile. Modest piles have ambitions, so I'd see to it before it grows.",
    'Something for you, briefly. The rest of the house is quiet.',
  ],
  // Four or more things waiting.
  pile: [
    "The queue has been breeding overnight. I've ranked it so you needn't count it.",
    'Rather a lot waiting, I\'m afraid. Take the top one; the others will keep, sulkily.',
    'The in-tray is ambitious this morning. Three items will do for now.',
    'A considerable pile, sir. We shall eat this elephant in small, well-ordered pieces.',
  ],
  // An agent check failed.
  broken: [
    "Something has gone wrong. I've put it first, where bad news belongs.",
    "A fault in the works this morning. I'd look at it before the tea goes cold.",
    'Not everything ran as it should. The particulars follow, without varnish.',
    "We have a problem, sir. It's at the top for a reason.",
  ],
  // Saturday or Sunday, with nothing broken.
  weekend: [
    "It's the weekend. The agents are working; there's no reason you should.",
    "Weekend duty only. I'll keep an eye on things while you don't.",
    "Whatever's waiting will keep until you've had breakfast. Possibly lunch.",
    'A weekend. If anything were on fire, it would be first in the list.',
  ],
};

/** broken beats weekend; otherwise the size of the queue decides. */
export function fentonState({ health, queue, date }) {
  if (health.some((h) => h.state === 'fail')) return 'broken';
  if (isWeekend(date)) return 'weekend';
  if (!queue.length) return 'clear';
  return queue.length <= 3 ? 'few' : 'pile';
}

/** The same line all day for a given state, and a different one most days. */
export function fentonLine(state, date) {
  const lines = LINES[state];
  let hash = 0;
  for (const ch of `${state}${date}`) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return lines[hash % lines.length];
}
