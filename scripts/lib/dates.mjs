// Calendar helpers for UK dates written as YYYY-MM-DD.
import { londonNow } from './state.mjs';

const noon = (date) => new Date(`${date}T12:00:00Z`);
export const addDays = (date, n) => new Date(noon(date).getTime() + n * 86400000).toISOString().slice(0, 10);
/** 0 is Sunday, 6 is Saturday. */
export const weekday = (date) => noon(date).getUTCDay();
export const daysBetween = (from, to) => Math.round((noon(to) - noon(from)) / 86400000);
/** The latest date on or before `date` that falls on `day` (0 Sunday … 6 Saturday). */
export const latestOn = (day, date) => addDays(date, -((weekday(date) - day + 7) % 7));
/** Monday of the week containing `date`. */
export const mondayOf = (date) => latestOn(1, date);
export const isWeekend = (date) => [0, 6].includes(weekday(date));

export const fmtDate = (date) =>
  noon(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
export const dayName = (date) => noon(date).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
export const clockOf = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** UK date and minutes past midnight for a timestamp. */
export const ukOf = (iso) => londonNow(new Date(iso));
/** Did a timestamp fall at or before `minutes` past midnight (UK) on `date`, or on an earlier day? */
export const byTime = (iso, date, minutes) => {
  const t = ukOf(iso);
  return t.date < date || (t.date === date && t.minutes <= minutes);
};

/** "today", "tomorrow", "by Saturday", "by 21 November" or "overdue since Tuesday". */
export function dueWords(by, today) {
  const d = daysBetween(today, by);
  if (d < 0) return `overdue since ${d >= -6 ? dayName(by) : fmtDate(by)}`;
  if (d === 0) return 'due today';
  if (d === 1) return 'due tomorrow';
  if (d <= 6) return `due by ${dayName(by)}`;
  return `due by ${noon(by).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`;
}
