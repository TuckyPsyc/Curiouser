#!/usr/bin/env node
// Validates every story in content/issues, then writes:
//   content/feed.json   – the index the app fetches
//   src/data/seed.json  – stories bundled into the app so it works offline on first open
// Usage: node scripts/build-feed.mjs [--check]
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const issuesDir = join(root, 'content', 'issues');
const checkOnly = process.argv.includes('--check');

// Issues 1–5 were the launch set. From issue 6, topics follow CYCLE in order:
// issue 6 is Science, issue 7 History, and so on, repeating every 15 issues.
const LAUNCH = ['History', 'Psychology', 'Literature', 'Self-Improvement', "Gentleman's Pursuits"];
const CYCLE = [
  'Science', 'History', 'Philosophy', 'Psychology', 'Nature', 'Literature', 'Economics',
  'Self-Improvement', 'Art & Music', 'Mathematics', "Gentleman's Pursuits", 'Society',
  'Technology', 'Language', 'Health & Medicine',
];
const TOPICS = CYCLE;
const topicFor = (id) => (id <= LAUNCH.length ? LAUNCH[id - 1] : CYCLE[(id - LAUNCH.length - 1) % CYCLE.length]);
const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isStrArr = (v) => Array.isArray(v) && v.length > 0 && v.every(isStr);
const isUrl = (v) => typeof v === 'string' && /^https:\/\/\S+$/.test(v);

const files = readdirSync(issuesDir).filter((f) => /^\d{4}\.json$/.test(f)).sort();
const issues = [];

for (const file of files) {
  let issue;
  try {
    issue = JSON.parse(readFileSync(join(issuesDir, file), 'utf8'));
  } catch (e) {
    fail(file, `invalid JSON (${e.message})`);
    continue;
  }
  const id = Number(file.slice(0, 4));
  if (issue.id !== id) fail(file, `id ${issue.id} does not match file name`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issue.date ?? '')) fail(file, 'date must be YYYY-MM-DD');
  if (!TOPICS.includes(issue.topic)) fail(file, `topic must be one of: ${TOPICS.join(', ')}`);
  for (const k of ['title', 'concept', 'teaser', 'takeaway']) if (!isStr(issue[k])) fail(file, `${k} missing`);
  if (!Number.isInteger(issue.readingMinutes) || issue.readingMinutes < 1) fail(file, 'readingMinutes must be a positive integer');
  if (!isStrArr(issue.story) || issue.story.length < 3) fail(file, 'story needs at least 3 paragraphs');

  const words = (issue.story ?? []).join(' ').split(/\s+/).length;
  if (words < 250 || words > 650) fail(file, `story is ${words} words; aim for 300–550`);

  if (issue.recall !== null) {
    const r = issue.recall ?? {};
    if (!isStr(r.question) || !isStr(r.answer) || !Number.isInteger(r.fromIssue)) fail(file, 'recall needs question, answer, fromIssue (or null)');
    else if (r.fromIssue >= id) fail(file, 'recall.fromIssue must point to an earlier issue');
  }

  const rh = issue.rabbitHole ?? {};
  if (!isStr(rh.title) || !isStr(rh.intro)) fail(file, 'rabbitHole needs title and intro');
  if (!Array.isArray(rh.levels) || rh.levels.length < 3 || rh.levels.length > 5) fail(file, 'rabbitHole needs 3–5 levels');
  else rh.levels.forEach((l, i) => {
    if (!isStr(l.heading) || !isStrArr(l.body)) fail(file, `rabbitHole level ${i + 1} needs heading and body`);
  });
  if (!Array.isArray(rh.furtherReading) || rh.furtherReading.length < 2) fail(file, 'rabbitHole needs at least 2 furtherReading items');
  else rh.furtherReading.forEach((r, i) => {
    if (!isStr(r.title)) fail(file, `furtherReading ${i + 1} needs a title`);
    if (r.url !== undefined && !isUrl(r.url)) fail(file, `furtherReading ${i + 1} url must be https`);
  });

  const lg = issue.lookingGlass ?? {};
  if (!['counter', 'none', 'myth'].includes(lg.kind)) fail(file, 'lookingGlass.kind must be counter, none or myth');
  if (!isStr(lg.heading) || !isStrArr(lg.body) || !isStr(lg.verdict)) fail(file, 'lookingGlass needs heading, body and verdict');
  if (!['Shaky', 'Contested', 'Well supported', 'Settled'].includes(lg.confidence)) fail(file, 'lookingGlass.confidence must be Shaky, Contested, Well supported or Settled');
  const lgWords = (lg.body ?? []).join(' ').split(/\s+/).length;
  if (lgWords < 60 || lgWords > 200) fail(file, `lookingGlass body is ${lgWords} words; aim for 80–160`);

  // The Caucus-race: Sunday's quiz draws on these. Options are shuffled in the app.
  if (!Array.isArray(issue.quiz) || issue.quiz.length < 2 || issue.quiz.length > 3) fail(file, 'quiz needs 2–3 questions');
  else issue.quiz.forEach((q, i) => {
    const n = `quiz ${i + 1}`;
    if (!isStr(q.question)) fail(file, `${n} needs a question`);
    if (!isStrArr(q.options) || q.options.length < 3 || q.options.length > 4) fail(file, `${n} needs 3–4 options`);
    else {
      if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== q.options.length) fail(file, `${n} has duplicate options`);
      if (q.options.some((o) => /\b(all|none|both) of (the|these) above\b|of the above/i.test(o))) fail(file, `${n}: options are shuffled, so don't refer to other options`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) fail(file, `${n}: answer must be the index of the right option`);
    }
    if (!isStr(q.explain)) fail(file, `${n} needs an explain line`);
    else if (q.explain.split(/\s+/).length > 45) fail(file, `${n}: keep explain under 45 words`);
  });

  const expectedTopic = topicFor(id);
  if (issue.topic !== expectedTopic) fail(file, `topic should be "${expectedTopic}" in the rotation (see CONTENT_GUIDE.md)`);

  if (!Array.isArray(issue.sources) || issue.sources.length < 3) fail(file, 'needs at least 3 sources');
  else issue.sources.forEach((s, i) => {
    if (!isStr(s.title)) fail(file, `source ${i + 1} needs a title`);
    if (s.url !== undefined && !isUrl(s.url)) fail(file, `source ${i + 1} url must be https`);
  });

  issues.push(issue);
}

// Cross-issue checks
const ids = issues.map((i) => i.id);
ids.forEach((id, i) => {
  if (id !== i + 1) fail(`${String(id).padStart(4, '0')}.json`, `ids must run 1, 2, 3… without gaps (expected ${i + 1})`);
});
for (const issue of issues) {
  if (issue.recall && !ids.includes(issue.recall.fromIssue)) fail(`${issue.id}`, `recall points to missing issue ${issue.recall.fromIssue}`);
}
const concepts = new Map();
for (const issue of issues) {
  const key = issue.concept?.toLowerCase().trim();
  if (concepts.has(key)) fail(`${issue.id}`, `concept "${issue.concept}" already used in issue ${concepts.get(key)}`);
  concepts.set(key, issue.id);
}

// No. 0, "Start here": the Alice story that doubles as the app's tutorial.
// It sits outside the numbered sequence and the topic rotation.
let start = null;
try {
  start = JSON.parse(readFileSync(join(root, 'content', 'start-here.json'), 'utf8'));
  const f = 'start-here.json';
  if (start.id !== 0) fail(f, 'id must be 0');
  for (const k of ['title', 'concept', 'teaser', 'takeaway']) if (!isStr(start[k])) fail(f, `${k} missing`);
  if (!isStrArr(start.story)) fail(f, 'story missing');
  if (!start.rabbitHole?.levels?.length) fail(f, 'rabbitHole missing');
  if (!start.lookingGlass?.heading) fail(f, 'lookingGlass missing');
  const keys = ['recall', 'sizes', 'takeaway', 'lookingGlass', 'rabbitHole', 'sources', 'shelves'];
  for (const k of keys) {
    const n = start.guide?.[k];
    if (!n || !isStr(n.title) || !isStr(n.text)) fail(f, `guide.${k} needs a title and text`);
  }
} catch (e) {
  fail('start-here.json', `unreadable (${e.message})`);
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n  ` + errors.join('\n  '));
  process.exit(1);
}

// Curly quotes for reading. Authors can type straight quotes; source files are left alone.
const smarten = (s) =>
  s
    .replace(/(^|[\s([{—–/-])'/g, '$1‘')
    .replace(/'/g, '’')
    .replace(/(^|[\s([{—–/-])"/g, '$1“')
    .replace(/"/g, '”');
const SKIP = new Set(['topic', 'url', 'date']);
const smartenDeep = (v, key) =>
  typeof v === 'string'
    ? SKIP.has(key) ? v : smarten(v)
    : Array.isArray(v)
      ? v.map((x) => smartenDeep(x, key))
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, smartenDeep(x, k)]))
        : v;
for (let i = 0; i < issues.length; i++) issues[i] = smartenDeep(issues[i]);
start = smartenDeep(start);

const summary = ({ id, date, topic, title, concept, teaser, readingMinutes }) => ({
  id, date, topic, title, concept, teaser, readingMinutes,
});
const index = {
  updated: new Date().toISOString(),
  issues: [...issues].sort((a, b) => b.id - a.id).map(summary),
};

if (!checkOnly) {
  writeFileSync(join(root, 'content', 'feed.json'), JSON.stringify(index, null, 2) + '\n');
  // Published copies with curly quotes, which is what the app fetches.
  mkdirSync(join(root, 'content', 'published'), { recursive: true });
  for (const issue of issues) {
    writeFileSync(
      join(root, 'content', 'published', `${String(issue.id).padStart(4, '0')}.json`),
      JSON.stringify(issue, null, 2) + '\n',
    );
  }
  writeFileSync(join(root, 'content', 'published', 'start-here.json'), JSON.stringify(start, null, 2) + '\n');
  mkdirSync(join(root, 'src', 'data'), { recursive: true });
  const seed = { index, start, issues: Object.fromEntries(issues.map((i) => [String(i.id), i])) };
  writeFileSync(join(root, 'src', 'data', 'seed.json'), JSON.stringify(seed) + '\n');
}
console.log(`✓ ${issues.length} issue(s) valid${checkOnly ? '' : '; wrote content/feed.json and src/data/seed.json'}`);
