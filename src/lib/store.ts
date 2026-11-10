import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/**
 * A small piece of state kept on the phone (D-011). Nothing here leaves the
 * device. Writes wait until the saved copy has loaded, so an early write can't
 * be overwritten by the load.
 */
export type Store<T> = {
  get: () => T;
  update: (fn: (prev: T) => T) => Promise<void>;
  subscribe: (listener: () => void) => () => void;
  ready: Promise<void>;
};

export function persisted<T extends object>(key: string, initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const ready = (async () => {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) value = { ...initial, ...(JSON.parse(raw) as Partial<T>) };
    } catch {
      // Storage is a convenience: start fresh rather than fail.
    }
    notify();
  })();

  return {
    get: () => value,
    ready,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async update(fn) {
      await ready;
      value = fn(value);
      notify();
      try {
        await AsyncStorage.setItem(key, JSON.stringify(value));
      } catch {}
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
