import { persisted, useStore } from './store';
import type { Issue, Topic } from './types';

/**
 * Jars: named collections of saved ideas, after the jar of orange marmalade
 * Alice takes down from a shelf as she falls. Kept on the phone only (D-011).
 * Each item keeps a copy of the title and idea, so jars work offline.
 */
export type JarItem = { id: number; title: string; idea: string; topic: Topic; savedAt: string };
export type Jar = { key: string; name: string; items: JarItem[] };
type JarsData = { jars: Jar[] };

export const FIRST_JAR = 'Orange Marmalade';

const store = persisted<JarsData>('jars-v1', { jars: [] });

export const useJars = () => useStore(store).jars;

const newKey = () => `j${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function createJar(name: string): string | null {
  const clean = name.trim().slice(0, 40);
  if (!clean) return null;
  const key = newKey();
  store.update((d) => ({ jars: [...d.jars, { key, name: clean, items: [] }] }));
  return key;
}

/** Make sure there's at least one jar to put things in. */
export function ensureFirstJar() {
  return store.update((d) =>
    d.jars.length ? d : { jars: [{ key: newKey(), name: FIRST_JAR, items: [] }] },
  );
}

export function toggleInJar(key: string, issue: Issue) {
  return store.update((d) => ({
    jars: d.jars.map((j) => {
      if (j.key !== key) return j;
      const has = j.items.some((i) => i.id === issue.id);
      return {
        ...j,
        items: has
          ? j.items.filter((i) => i.id !== issue.id)
          : [
              {
                id: issue.id,
                title: issue.title,
                idea: issue.takeaway,
                topic: issue.topic,
                savedAt: new Date().toISOString(),
              },
              ...j.items,
            ],
      };
    }),
  }));
}

export function removeFromJar(key: string, id: number) {
  return store.update((d) => ({
    jars: d.jars.map((j) => (j.key === key ? { ...j, items: j.items.filter((i) => i.id !== id) } : j)),
  }));
}

export function deleteJar(key: string) {
  return store.update((d) => ({ jars: d.jars.filter((j) => j.key !== key) }));
}
