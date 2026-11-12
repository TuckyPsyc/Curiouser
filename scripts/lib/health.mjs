// Is each agent doing its job? Judged by what it produced, not by the task list,
// which shows "succeeded" even for a run the plan's usage limit cut short (D-016).
//
// Each check is ✓ (ok), ✗ (fail) or "not due". Times are UK.
import { addDays, latestOn, fmtDate, clockOf, byTime, ukOf } from './dates.mjs';

export const STORY_BY = 5 * 60 + 30; // the Editor runs at 04:47
export const VERDICT_BY = 6 * 60 + 30; // the fact-checker runs at 05:40
export const VIDEO_BY = 6 * 60 + 45; // the Producer runs at 06:07; GitHub renders in about five minutes
const PRODUCER_RUNS = 6 * 60 + 7;
// The weekly agents: which day, when their work is due, and the first week it was due.
const WEEKLY = {
  developer: { name: 'Developer', day: 6, starts: 7 * 60 + 10, by: 9 * 60 + 30, first: '2026-11-14' },
  marketing: { name: 'Marketing', day: 0, starts: 7 * 60 + 37, by: 9 * 60 + 30, first: '2026-11-15' },
  analyst: { name: 'Analyst', day: 1, starts: 6 * 60 + 23, by: 7 * 60 + 30, first: '2026-11-16' },
};

const verdictWords = { pass: 'passed', fixed: 'corrected and released', held: 'held back', 'released-unchecked': 'released unchecked' };

/**
 * @param h.uk        today in the UK ({ date, minutes })
 * @param h.stories   from loadStories()
 * @param h.scripts   Set of story ids with a video script in videos/
 * @param h.rendered  Set of story ids with a finished video on the "Videos" release
 * @param h.briefs    marketing brief dates (YYYY-MM-DD)
 * @param h.reports   weekly report dates (YYYY-MM-DD)
 * @param h.pulls     recent pull requests, open or closed
 * @param h.ready     IDEAS.md items marked Ready that don't already have an open pull request
 * @param h.failures  workflow runs that failed in the last 24 hours
 */
export function agentHealth(h) {
  const { uk, stories } = h;
  const out = [];
  const ok = (agent, text) => out.push({ agent, state: 'ok', text });
  const fail = (agent, text) => out.push({ agent, state: 'fail', text });
  const notDue = (agent, text) => out.push({ agent, state: 'not-due', text });

  // The Editor: today's story exists by 05:30.
  const todays = stories.filter((s) => s.date === uk.date).at(-1);
  if (todays) ok('Editor', `No. ${todays.id} written.`);
  else if (uk.minutes < STORY_BY) notDue('Editor', `today's story is due by ${clockOf(STORY_BY)}.`);
  else fail('Editor', 'no story for today.');

  // The fact-checker: today's story has a verdict by 06:30.
  const c = todays?.check;
  if (!todays) notDue('Fact-checker', uk.minutes < VERDICT_BY ? `a verdict is due by ${clockOf(VERDICT_BY)}.` : 'no story to check.');
  else if (c?.by === 'fact-checker' && byTime(c.at, uk.date, VERDICT_BY)) ok('Fact-checker', `No. ${todays.id} ${verdictWords[c.verdict] ?? c.verdict}.`);
  else if (c?.by === 'fact-checker') fail('Fact-checker', `No. ${todays.id} ${verdictWords[c.verdict] ?? c.verdict}, but late, at ${ukOf(c.at).clock}.`);
  else if (uk.minutes < VERDICT_BY) notDue('Fact-checker', `No. ${todays.id}'s verdict is due by ${clockOf(VERDICT_BY)}.`);
  else if (c) fail('Fact-checker', `No. ${todays.id} had no check; it was ${verdictWords[c.verdict] ?? c.verdict} by the ${c.by}.`);
  else fail('Fact-checker', `No. ${todays.id} has no verdict.`);

  // The Producer: a script and a finished video for yesterday's checked story by 06:45.
  // Only a story the fact-checker passed before the Producer ran was its to film.
  const y = stories.filter((s) => s.date === addDays(uk.date, -1)).at(-1);
  const yc = y?.check;
  const passed = yc?.by === 'fact-checker' && ['pass', 'fixed'].includes(yc.verdict);
  const made = y && h.scripts.has(y.id) && h.rendered.has(y.id);
  if (!y) notDue('Producer', 'no story yesterday to film.');
  else if (made) ok('Producer', `No. ${y.id}: script and video made.`);
  else if (!passed) notDue('Producer', `No. ${y.id} wasn't passed by the fact-checker, so there's nothing to film.`);
  else if (!byTime(yc.at, uk.date, PRODUCER_RUNS)) notDue('Producer', `No. ${y.id} was checked after the Producer ran.`);
  else if (uk.minutes < VIDEO_BY) notDue('Producer', `the video of No. ${y.id} is due by ${clockOf(VIDEO_BY)}.`);
  else if (!h.scripts.has(y.id)) fail('Producer', `no script for No. ${y.id}.`);
  else fail('Producer', `No. ${y.id} has a script but no finished video.`);

  // The weekly agents.
  const weekly = (key, done, missing) => {
    const w = WEEKLY[key];
    const due = latestOn(w.day, uk.date);
    if (due < w.first) return notDue(w.name, `first run ${fmtDate(w.first)}.`);
    if (due === uk.date && uk.minutes < w.by && !done(due)) return notDue(w.name, `due by ${clockOf(w.by)} today.`);
    const result = done(due);
    if (result) return ok(w.name, result);
    return missing ? missing(due) : fail(w.name, `nothing dated ${fmtDate(due)}.`);
  };
  weekly('marketing', (d) => (h.briefs.includes(d) ? `brief for ${fmtDate(d)} written.` : null));
  weekly('analyst', (d) => (h.reports.includes(d) ? `report for ${fmtDate(d)} written.` : null));
  weekly(
    'developer',
    (d) => {
      // A pull request opened on or after the Saturday run started.
      const p = h.pulls.find((p) => {
        const t = ukOf(p.created_at);
        return (t.date > d || (t.date === d && t.minutes >= WEEKLY.developer.starts - 10)) && ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(p.author_association);
      });
      return p ? `pull request #${p.number} opened.` : null;
    },
    (d) => (h.ready > 0 ? fail('Developer', `no pull request since ${fmtDate(d)}.`) : notDue('Developer', 'nothing in IDEAS.md was Ready to build.')),
  );

  // Automation on GitHub: failed runs in the last 24 hours.
  if (!h.failures.length) ok('Automation', 'no failed runs in the last day.');
  else {
    const names = [...new Set(h.failures.map((r) => r.name))];
    fail('Automation', `${h.failures.length === 1 ? 'one failed run' : `${h.failures.length} failed runs`} in the last day: ${names.join(', ')}.`);
  }
  return out;
}

export const healthIcon = { ok: '✓', fail: '✗', 'not-due': '–' };
