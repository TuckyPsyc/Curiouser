import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import seedData from '../data/seed.json';
import type { FeedIndex, Issue, IssueSummary } from './types';

/**
 * Stories live in the public GitHub repo and are fetched at runtime, so new
 * issues reach the app without a new build. See DECISIONS.md (D-001).
 */
export const CONTENT_BASE =
  'https://raw.githubusercontent.com/TuckyPsyc/curiouser/main/content';

const seed = seedData as unknown as { index: FeedIndex; issues: Record<string, Issue> };

const INDEX_KEY = 'feed-index-v1';
const issueKey = (id: number) => `issue-v1-${id}`;
const memory = new Map<number, Issue>();

export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export const issuePath = (id: number) => `published/${String(id).padStart(4, '0')}.json`;

function published(issues: IssueSummary[]): IssueSummary[] {
  const today = todayISO();
  return issues.filter((i) => i.date <= today).sort((a, b) => b.id - a.id);
}

function merge(...lists: IssueSummary[][]): IssueSummary[] {
  const byId = new Map<number, IssueSummary>();
  for (const list of lists) for (const i of list) byId.set(i.id, i);
  return [...byId.values()];
}

async function readJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is a convenience; the app still works from the network and seed.
  }
}

async function fetchJSON<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    // Ten-minute cache-buster so a fresh issue appears soon after it's published.
    const bucket = Math.floor(Date.now() / 600000);
    const res = await fetch(`${CONTENT_BASE}/${path}?v=${bucket}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export type FeedStatus = 'loading' | 'ready' | 'offline';

export function useFeed() {
  const [issues, setIssues] = useState<IssueSummary[]>(() => published(seed.index.issues));
  const [status, setStatus] = useState<FeedStatus>('loading');
  const alive = useRef(true);

  const load = useCallback(async () => {
    setStatus('loading');
    const cached = await readJSON<FeedIndex>(INDEX_KEY);
    if (cached && alive.current) {
      setIssues(published(merge(seed.index.issues, cached.issues)));
    }
    try {
      const remote = await fetchJSON<FeedIndex>('feed.json');
      if (!Array.isArray(remote.issues)) throw new Error('Bad feed');
      await writeJSON(INDEX_KEY, remote);
      if (alive.current) {
        setIssues(published(merge(seed.index.issues, remote.issues)));
        setStatus('ready');
      }
    } catch {
      if (alive.current) setStatus('offline');
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  return { issues, status, refresh: load };
}

function fromSeed(id: number): Issue | null {
  return seed.issues[String(id)] ?? null;
}

export function useIssue(id: number | null) {
  const [issue, setIssue] = useState<Issue | null>(() =>
    id == null ? null : memory.get(id) ?? fromSeed(id),
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (id == null || Number.isNaN(id)) return;
    let alive = true;
    setFailed(false);
    const known = memory.get(id) ?? fromSeed(id);
    setIssue(known);

    (async () => {
      if (!known) {
        const cached = await readJSON<Issue>(issueKey(id));
        if (cached && alive) setIssue(cached);
      }
      try {
        // Always refresh so corrections made after publication reach readers.
        const remote = await fetchJSON<Issue>(issuePath(id));
        memory.set(id, remote);
        await writeJSON(issueKey(id), remote);
        if (alive) setIssue(remote);
      } catch {
        if (alive) setFailed(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  return { issue, failed };
}
