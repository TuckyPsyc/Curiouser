/** Calendar helpers on local YYYY-MM-DD strings, so days follow the reader's clock. */

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // midday, so clock changes never shift the day
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** 0 = Sunday … 6 = Saturday. */
export const weekday = (iso: string) => fromISO(iso).getDay();

/** The Monday on or before this day. */
export const mondayOf = (iso: string) => addDays(iso, -((weekday(iso) + 6) % 7));

/** The Sunday on or before this day. */
export const sundayOnOrBefore = (iso: string) => addDays(iso, -weekday(iso));

export const dayName = (iso: string) =>
  fromISO(iso).toLocaleDateString('en-GB', { weekday: 'long' });

export const dayInitial = (iso: string) => 'SMTWTFS'[weekday(iso)];

/** Whole days from a to b (b later is positive). */
export function daysBetween(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
}
