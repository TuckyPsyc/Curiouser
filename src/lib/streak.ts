import { addDays, daysBetween, mondayOf } from './dates';

/**
 * The Hatter's watch: a forgiving reading streak.
 *
 * A day counts when the reader reaches the end of a story or uses Drink Me.
 * The streak is the run of counted days up to today; it stays alive until
 * today is over. Once a week the reader gets a Hatter's Hour, which stops the
 * clock on one missed day so the run carries on ("It's always six o'clock now").
 * Hours aren't saved up: one per week, Monday to Sunday, use it or lose it.
 */
export type StreakData = {
  /** Days read, as YYYY-MM-DD. */
  read: string[];
  /** Days covered by a Hatter's Hour, and the day it was used. */
  frozen: { day: string; usedOn: string }[];
};

export const EMPTY_STREAK: StreakData = { read: [], frozen: [] };

export type DayState = 'read' | 'frozen' | 'missed';

export function dayState(data: StreakData, day: string): DayState {
  if (data.read.includes(day)) return 'read';
  if (data.frozen.some((f) => f.day === day)) return 'frozen';
  return 'missed';
}

const covered = (data: StreakData, day: string) => dayState(data, day) !== 'missed';

/** Consecutive counted days ending today, or yesterday if today isn't read yet. */
export function streakLength(data: StreakData, today: string): number {
  let day = covered(data, today) ? today : addDays(today, -1);
  let n = 0;
  while (covered(data, day) && n < 3660) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** The last seven days, oldest first, ending today. */
export function lastSeven(data: StreakData, today: string): { day: string; state: DayState }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    return { day, state: dayState(data, day) };
  });
}

export function hourAvailable(data: StreakData, today: string): boolean {
  const week = mondayOf(today);
  return !data.frozen.some((f) => mondayOf(f.usedOn) === week);
}

/**
 * The missed day a Hatter's Hour would rescue, if any: the most recent gap
 * before today, within the past week, with a counted day just before it, so
 * that stopping the clock joins two runs together.
 */
export function rescuableDay(data: StreakData, today: string): string | null {
  if (!hourAvailable(data, today)) return null;
  let day = addDays(today, -1);
  while (covered(data, day) && daysBetween(day, today) <= 7) day = addDays(day, -1);
  if (daysBetween(day, today) > 6) return null;
  return covered(data, addDays(day, -1)) ? day : null;
}

/** Every day ever read. Never goes down. */
export const totalDays = (data: StreakData) => data.read.length;

/**
 * Weeks in a row (Monday to Sunday) with at least one day read or stopped.
 * Missing a day can't reset it; only a whole week off can. This week counts
 * once it has a day in it, and the run stays alive until this week is over.
 */
export function weekRun(data: StreakData, today: string): number {
  const hasDay = (monday: string) =>
    Array.from({ length: 7 }, (_, i) => addDays(monday, i)).some(
      (d) => d <= today && covered(data, d),
    );
  let monday = mondayOf(today);
  if (!hasDay(monday)) monday = addDays(monday, -7);
  let n = 0;
  while (hasDay(monday) && n < 1000) {
    n++;
    monday = addDays(monday, -7);
  }
  return n;
}

export function withRead(data: StreakData, today: string): StreakData {
  if (data.read.includes(today)) return data;
  // Kept in full, so the total never drops (a year of dates is about 4 KB).
  return { ...data, read: [...data.read, today] };
}

export function withFrozen(data: StreakData, day: string, today: string): StreakData {
  if (rescuableDay(data, today) !== day) return data;
  return { ...data, frozen: [...data.frozen, { day, usedOn: today }] };
}
