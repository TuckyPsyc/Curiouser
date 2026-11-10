import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { toISO } from './dates';
import { persisted, useStore } from './store';
import { EMPTY_STREAK, withFrozen, withRead, type StreakData } from './streak';

const streakStore = persisted<StreakData>('streak-v1', EMPTY_STREAK);

/** Count today as read. Safe to call repeatedly. */
export function markRead() {
  return streakStore.update((d) => withRead(d, toISO(new Date())));
}

/** Use this week's Hatter's Hour on a missed day. */
export function stopTheClock(day: string) {
  return streakStore.update((d) => withFrozen(d, day, toISO(new Date())));
}

export const useStreakData = () => useStore(streakStore);

/** Today's date, refreshed when the app comes back to the foreground. */
export function useToday(): string {
  const [today, setToday] = useState(() => toISO(new Date()));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setToday(toISO(new Date()));
    });
    return () => sub.remove();
  }, []);
  return today;
}
