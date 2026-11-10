import { addDays, sundayOnOrBefore } from './dates';
import { persisted, useStore } from './store';
import type { Issue, IssueSummary, QuizQuestion } from './types';

/**
 * The Caucus-race: Sunday's quiz on the week's stories.
 * "Everybody has won, and all must have prizes." (the Dodo)
 *
 * Each race is named by its Sunday and covers the seven days ending that
 * Sunday. It opens on the Sunday and stays open until the next one. Everyone
 * gets the same five questions in the same order, picked with the Sunday as
 * the seed, so friends can compare notes. Everyone who finishes gets a comfit.
 */
export const RACE_LENGTH = 5;

export type Race = { date: string; from: string; ids: number[] };

export function currentRace(today: string, issues: IssueSummary[]): Race | null {
  const date = sundayOnOrBefore(today);
  const from = addDays(date, -6);
  const ids = issues
    .filter((i) => i.id > 0 && i.date >= from && i.date <= date)
    .map((i) => i.id)
    .sort((a, b) => a - b);
  // Two questions a story, so three stories are enough for five questions.
  return ids.length >= 3 ? { date, from, ids } : null;
}

/** A small seeded random number generator (mulberry32), so every phone picks the same. */
function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type RaceQuestion = QuizQuestion & {
  issueId: number;
  issueTitle: string;
  /** Options in the order shown; `answer` indexes into this. */
  shown: string[];
  correct: number;
};

/**
 * Picks the race's questions: one from each story first, spread across the
 * week, then a second from some if there are fewer than five stories. Shown in
 * story order, with options shuffled.
 */
export function pickQuestions(race: Race, issues: Issue[]): RaceQuestion[] {
  const rand = seeded(`caucus-${race.date}`);
  const pools = [...issues]
    .sort((a, b) => a.id - b.id)
    .filter((i) => i.quiz?.length)
    .map((i) => ({ issue: i, qs: shuffle(i.quiz!, rand) }));
  const order = shuffle(pools, rand);
  const picked: { issue: Issue; q: QuizQuestion }[] = [];
  for (let round = 0; picked.length < RACE_LENGTH && round < 3; round++) {
    for (const { issue, qs } of order) {
      if (picked.length >= RACE_LENGTH) break;
      if (qs[round]) picked.push({ issue, q: qs[round] });
    }
  }
  picked.sort((a, b) => a.issue.id - b.issue.id);
  return picked.map(({ issue, q }) => {
    const idx = shuffle(
      q.options.map((_, i) => i),
      rand,
    );
    return {
      ...q,
      issueId: issue.id,
      issueTitle: issue.title,
      shown: idx.map((i) => q.options[i]),
      correct: idx.indexOf(q.answer),
    };
  });
}

type RaceResult = { score: number; total: number; at: string };
type RaceData = { results: Record<string, RaceResult> };

const store = persisted<RaceData>('caucus-race-v1', { results: {} });

export const useRaceResults = () => useStore(store).results;

/** Records the first finish of a race; reruns don't change the score or add a comfit. */
export function recordFinish(date: string, score: number, total: number) {
  return store.update((d) =>
    d.results[date]
      ? d
      : { results: { ...d.results, [date]: { score, total, at: new Date().toISOString() } } },
  );
}
