/** Every topic Curiouser covers. Kept broad on purpose (DECISIONS.md, D-007). */
export const TOPICS = [
  'History',
  'Psychology',
  'Science',
  'Literature',
  'Philosophy',
  'Nature',
  'Economics',
  'Self-Improvement',
  'Art & Music',
  'Mathematics',
  "Gentleman's Pursuits",
  'Society',
  'Technology',
  'Language',
  'Health & Medicine',
] as const;

export type Topic = (typeof TOPICS)[number];

export type Source = {
  title: string;
  url?: string;
};

export type RecallPrompt = {
  question: string;
  answer: string;
  /** The issue the question looks back to. */
  fromIssue: number;
};

export type RabbitHoleLevel = {
  heading: string;
  body: string[];
};

export type FurtherReading = {
  title: string;
  author?: string;
  note?: string;
  url?: string;
};

export type RabbitHole = {
  title: string;
  intro: string;
  levels: RabbitHoleLevel[];
  furtherReading: FurtherReading[];
};

export const CONFIDENCE = ['Shaky', 'Contested', 'Well supported', 'Settled'] as const;
export type Confidence = (typeof CONFIDENCE)[number];

/**
 * The other side of the day's idea.
 * - counter: the strongest real objection or limit
 * - none: there isn't a serious case against it, and we say so
 * - myth: a popular "counter" that doesn't hold up, debunked
 */
export type LookingGlass = {
  kind: 'counter' | 'none' | 'myth';
  heading: string;
  body: string[];
  confidence: Confidence;
  verdict: string;
};

export type Issue = {
  id: number;
  /** Publication date, YYYY-MM-DD (UK). The app hides issues dated in the future. */
  date: string;
  topic: Topic;
  title: string;
  /** The named idea the story teaches, e.g. "Goodhart's law". */
  concept: string;
  /** One-line teaser shown in the archive. */
  teaser: string;
  readingMinutes: number;
  story: string[];
  takeaway: string;
  recall: RecallPrompt | null;
  rabbitHole: RabbitHole;
  /** Optional in the type so older cached issues still render. */
  lookingGlass?: LookingGlass;
  sources: Source[];
};

export type IssueSummary = Pick<
  Issue,
  'id' | 'date' | 'topic' | 'title' | 'concept' | 'teaser' | 'readingMinutes'
>;

export type FeedIndex = {
  updated: string;
  issues: IssueSummary[];
};
