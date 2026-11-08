export const TOPICS = [
  'Psychology',
  'Literature',
  'History',
  'Self-Improvement',
  "Gentleman's Pursuits",
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
