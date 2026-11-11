#!/usr/bin/env node
// Gathers what can honestly be measured about Curiouser for one week, for the
// Analyst's Monday report. It counts; it doesn't interpret. Anything it can't
// reach is reported as unavailable, never guessed.
//
// Usage: node scripts/stats.mjs [--from YYYY-MM-DD --to YYYY-MM-DD] [--no-save]
//   With no dates it covers the last complete week, Monday to Sunday (UK dates).
//
// It prints the numbers as Markdown and saves them to reports/data/<today>.json,
// so next week's report can say what changed.
//
// What it can't see, by design: who reads, what they read, quiz take-up. The
// app has no accounts and no analytics (DECISIONS.md, D-005 and D-011).
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { root, loadStories, londonNow, pad } from './lib/state.mjs';

const args = process.argv.slice(2);
const opt = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);
const repo = process.env.GITHUB_REPOSITORY || 'TuckyPsyc/curiouser';
const today = londonNow().date;
const day = (iso, add = 0) => new Date(Date.parse(`${iso}T12:00:00Z`) + add * 86400000).toISOString().slice(0, 10);
const ukDate = (iso) => londonNow(new Date(iso)).date;

// The last complete Monday-to-Sunday week before today.
const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
const from = opt('--from') ?? day(today, -dow - 7);
const to = opt('--to') ?? day(from, 6);
const inWindow = (d) => d >= from && d <= to;

const unavailable = [];
function gh(path) {
  const r = spawnSync('gh', ['api', path], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
}
const need = (what, value) => {
  if (value === null) unavailable.push(what);
  return value;
};

// ---------- Stories and checks (from the repository itself) ----------
const { stories } = loadStories();
const launch = stories[0]?.date ?? from;
const weekStories = stories.filter((s) => inWindow(s.date));
const storyDays = new Set(stories.map((s) => s.date));
const daysExpected = [];
for (let d = from; d <= to && d <= today; d = day(d, 1)) if (d >= launch) daysExpected.push(d);
const missingDays = daysExpected.filter((d) => !storyDays.has(d));
const row = (s) => ({
  id: s.id, date: s.date, title: s.title, topic: s.topic, status: s.status,
  verdict: s.check?.verdict ?? null, by: s.check?.by ?? null,
  changes: s.check?.changes?.length ?? 0, problems: s.check?.problems?.length ?? 0,
  claimsChecked: s.check?.claims?.checked ?? null, linksChecked: s.check?.links?.checked ?? null,
});
// Checks carried out in the window, whenever the story was written (this includes re-checks).
const checksDone = stories.filter((s) => s.check?.by === 'fact-checker' && inWindow(ukDate(s.check.at)));
const count = (xs, f) => xs.filter(f).length;
const storiesBlock = {
  written: weekStories.length,
  daysExpected: daysExpected.length,
  daysWithNoStory: missingDays,
  released: count(weekStories, (s) => s.status === 'released'),
  held: count(weekStories, (s) => s.status === 'held'),
  stillDrafts: count(weekStories, (s) => s.status === 'draft'),
  releasedUnchecked: count(weekStories, (s) => s.check?.verdict === 'released-unchecked'),
  list: weekStories.map(row),
};
const checksBlock = {
  done: checksDone.length,
  pass: count(checksDone, (s) => s.check.verdict === 'pass'),
  fixed: count(checksDone, (s) => s.check.verdict === 'fixed'),
  held: count(checksDone, (s) => s.check.verdict === 'held'),
  corrections: checksDone.reduce((n, s) => n + (s.check.changes?.length ?? 0), 0),
  claimsChecked: checksDone.reduce((n, s) => n + (s.check.claims?.checked ?? 0), 0),
  linksChecked: checksDone.reduce((n, s) => n + (s.check.links?.checked ?? 0), 0),
  openProblems: stories.filter((s) => s.status === 'released' && s.check?.problems?.length).map((s) => s.id),
  neverChecked: stories.filter((s) => s.check?.by === 'launch').map((s) => s.id),
  list: checksDone.map(row),
};

// ---------- Videos ----------
const videosDir = join(root, 'videos');
const scripts = existsSync(videosDir) ? readdirSync(videosDir).filter((f) => /^\d{4}\.json$/.test(f)).map((f) => Number(f.slice(0, 4))) : [];
const passed = weekStories.filter((s) => s.check?.by === 'fact-checker' && ['pass', 'fixed'].includes(s.check.verdict));
const videosBlock = {
  checkedStoriesThisWeek: passed.length,
  ofThoseWithAScript: count(passed, (s) => scripts.includes(s.id)),
  scriptsInAll: scripts.length,
};

// ---------- GitHub: downloads, automation, pull requests, tickets ----------
const dataDir = join(root, 'reports', 'data');
const previous = existsSync(dataDir)
  ? readdirSync(dataDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) < today).sort().at(-1)
  : null;
const before = previous ? JSON.parse(readFileSync(join(dataDir, previous), 'utf8')) : null;

const releases = need('APK downloads (GitHub releases)', gh(`repos/${repo}/releases?per_page=100`));
const apk = (releases ?? [])
  .map((r) => ({ tag: r.tag_name, published: r.published_at?.slice(0, 10), downloads: r.assets.find((a) => a.name === 'curiouser.apk')?.download_count }))
  .filter((r) => r.downloads !== undefined);
const downloadsBlock = releases && {
  // GitHub counts every download of the file: reinstalls, retries and robots included. It is not a count of people or phones.
  total: apk.reduce((n, r) => n + r.downloads, 0),
  sinceLastReport: before?.downloads ? apk.reduce((n, r) => n + r.downloads, 0) - before.downloads.total : null,
  lastReport: previous?.slice(0, 10) ?? null,
  perRelease: apk.map((r) => ({ ...r, sinceLastReport: before?.downloads ? r.downloads - (before.downloads.perRelease.find((p) => p.tag === r.tag)?.downloads ?? 0) : null })),
};

const runs = need('automation runs (GitHub Actions)', gh(`repos/${repo}/actions/runs?created=${from}..${day(to, 1)}&per_page=100`));
const weekRuns = (runs?.workflow_runs ?? []).filter((r) => inWindow(ukDate(r.created_at)) && r.head_branch !== 'rehearsal');
const byWorkflow = {};
for (const r of weekRuns) {
  const w = (byWorkflow[r.name] ??= { runs: 0, failed: 0 });
  w.runs++;
  if (r.conclusion === 'failure' || r.conclusion === 'timed_out') w.failed++;
}
const automationBlock = runs && {
  runs: weekRuns.length,
  failed: weekRuns.filter((r) => r.conclusion === 'failure' || r.conclusion === 'timed_out').map((r) => ({ workflow: r.name, when: r.created_at, url: r.html_url })),
  byWorkflow,
  truncated: (runs.total_count ?? 0) > 100,
};

const pulls = need('pull requests', gh(`repos/${repo}/pulls?state=all&per_page=100`));
const pullsBlock = pulls && {
  opened: pulls.filter((p) => inWindow(ukDate(p.created_at))).map((p) => ({ number: p.number, title: p.title })),
  merged: pulls.filter((p) => p.merged_at && inWindow(ukDate(p.merged_at))).map((p) => ({ number: p.number, title: p.title })),
  closedUnmerged: pulls.filter((p) => !p.merged_at && p.closed_at && inWindow(ukDate(p.closed_at))).map((p) => ({ number: p.number, title: p.title })),
  openNow: pulls.filter((p) => p.state === 'open').map((p) => ({ number: p.number, title: p.title, openedDaysAgo: Math.floor((Date.now() - Date.parse(p.created_at)) / 86400000) })),
};

// Tickets the desk raised for Carl: the clearest sign that an agent didn't do its job that morning.
const issues = need('release tickets', gh(`repos/${repo}/issues?labels=release-ticket&state=all&per_page=100`));
const tickets = (issues ?? [])
  .filter((i) => !i.pull_request && !i.labels.some((l) => l.name === 'rehearsal') && inWindow(ukDate(i.created_at)))
  .map((i) => ({ number: i.number, kind: /kind=(\w+)/.exec(i.body ?? '')?.[1] ?? 'unknown', title: i.title, state: i.state, closedAs: i.state_reason ?? null }));
const ticketsBlock = issues && {
  unchecked: count(tickets, (t) => t.kind === 'unchecked'),
  held: count(tickets, (t) => t.kind === 'held'),
  noStory: count(tickets, (t) => t.kind === 'missing'),
  releasedByCarl: count(tickets, (t) => t.kind === 'unchecked' && t.closedAs === 'completed'),
  list: tickets,
};

// Repository traffic needs more access than the agents have; say so rather than guess.
const views = gh(`repos/${repo}/traffic/views`);
const clones = gh(`repos/${repo}/traffic/clones`);
const trafficBlock = views && clones ? { views14Days: views.count, visitors14Days: views.uniques, clones14Days: clones.count, cloners14Days: clones.uniques } : null;

const support = existsSync(join(root, 'support', 'status.json')) ? JSON.parse(readFileSync(join(root, 'support', 'status.json'), 'utf8')) : null;

const data = {
  made: new Date().toISOString(), from, to,
  stories: storiesBlock, checks: checksBlock, videos: videosBlock,
  downloads: downloadsBlock, automation: automationBlock, pulls: pullsBlock, tickets: ticketsBlock,
  traffic: trafficBlock, support,
  allTime: { stories: stories.length, released: count(stories, (s) => s.status === 'released'), checkedByFactChecker: count(stories, (s) => s.check?.by === 'fact-checker') },
  unavailable,
};

// ---------- Print ----------
const na = '*unavailable*';
const out = [];
const p = (...l) => out.push(...l);
p(`# Curiouser, ${from} to ${to}`, '', `Counted ${data.made.slice(0, 16).replace('T', ' ')} UTC.${previous ? ` Last report: ${previous.slice(0, 10)}.` : ' No earlier report to compare with.'}`, '');
p('## Stories', '', `- Written: **${storiesBlock.written}** on ${storiesBlock.daysExpected} day(s)${missingDays.length ? `; no story on ${missingDays.join(', ')}` : ''}`,
  `- Released: ${storiesBlock.released} · held: ${storiesBlock.held} · still drafts: ${storiesBlock.stillDrafts} · released unchecked: ${storiesBlock.releasedUnchecked}`, '');
if (weekStories.length) p('| No. | Date | Topic | Title | Verdict | By | Changes |', '|---|---|---|---|---|---|---|', ...storiesBlock.list.map((s) => `| ${s.id} | ${s.date} | ${s.topic} | ${s.title} | ${s.verdict ?? 'none (draft)'} | ${s.by ?? ''} | ${s.changes} |`), '');
p('## Fact-checks carried out', '', `- Checks: **${checksBlock.done}** (pass ${checksBlock.pass}, fixed ${checksBlock.fixed}, held ${checksBlock.held})`,
  `- Corrections made: ${checksBlock.corrections} · claims checked: ${checksBlock.claimsChecked} · links opened: ${checksBlock.linksChecked}`,
  `- Published stories never checked: ${checksBlock.neverChecked.length ? checksBlock.neverChecked.map((i) => (i === 0 ? 'Start here' : `No. ${i}`)).join(', ') : 'none'}`,
  `- Published stories with problems the checker couldn't fix: ${checksBlock.openProblems.length ? checksBlock.openProblems.map((i) => `No. ${i}`).join(', ') : 'none'}`, '');
if (checksDone.length) p('| No. | Title | Verdict | Claims | Links | Changes |', '|---|---|---|---|---|---|', ...checksBlock.list.map((s) => `| ${s.id} | ${s.title} | ${s.verdict} | ${s.claimsChecked ?? ''} | ${s.linksChecked ?? ''} | ${s.changes} |`), '');
p('## Mornings that needed Carl', '', ticketsBlock
  ? `- Unchecked story: ${ticketsBlock.unchecked} (released by Carl: ${ticketsBlock.releasedByCarl}) · held story: ${ticketsBlock.held} · no story at all: ${ticketsBlock.noStory}`
  : `- ${na}`, '');
p('## Videos', '', `- Checked stories this week: ${videosBlock.checkedStoriesThisWeek}, of which with a video script: ${videosBlock.ofThoseWithAScript}. Scripts in all: ${videosBlock.scriptsInAll}.`,
  '- Whether a video was posted, and how it did, isn\'t recorded anywhere the team can see.', '');
p('## APK downloads', '');
if (downloadsBlock) {
  p(`- All releases: **${downloadsBlock.total}**${downloadsBlock.sinceLastReport === null ? '' : ` (${downloadsBlock.sinceLastReport >= 0 ? '+' : ''}${downloadsBlock.sinceLastReport} since ${downloadsBlock.lastReport})`}`,
    '- These are downloads of the file, including reinstalls and anything automated. They aren\'t people, phones or readers.', '',
    '| Release | Published | Downloads | Since last report |', '|---|---|---|---|', ...downloadsBlock.perRelease.map((r) => `| ${r.tag} | ${r.published} | ${r.downloads} | ${r.sinceLastReport ?? ''} |`), '');
} else p(`- ${na}`, '');
p('## Pull requests', '', pullsBlock
  ? `- Opened: ${pullsBlock.opened.length}${pullsBlock.opened.length ? ` (${pullsBlock.opened.map((x) => `#${x.number} ${x.title}`).join('; ')})` : ''} · merged: ${pullsBlock.merged.length}${pullsBlock.merged.length ? ` (${pullsBlock.merged.map((x) => `#${x.number}`).join(', ')})` : ''} · closed unmerged: ${pullsBlock.closedUnmerged.length} · open now: ${pullsBlock.openNow.length}${pullsBlock.openNow.length ? ` (${pullsBlock.openNow.map((x) => `#${x.number}, ${x.openedDaysAgo} day(s) old`).join('; ')})` : ''}`
  : `- ${na}`, '');
p('## Automation on GitHub', '');
if (automationBlock) {
  p(`- Runs: ${automationBlock.runs}, failed: **${automationBlock.failed.length}**${automationBlock.truncated ? ' (more than 100 runs this week; only the newest 100 were counted)' : ''}`,
    ...automationBlock.failed.map((f) => `  - ${f.workflow}, ${f.when.slice(0, 16).replace('T', ' ')} UTC: ${f.url}`), '',
    '| Workflow | Runs | Failed |', '|---|---|---|', ...Object.entries(byWorkflow).map(([n, w]) => `| ${n} | ${w.runs} | ${w.failed} |`), '');
} else p(`- ${na}`, '');
p('## Repository traffic', '', trafficBlock
  ? `- Last 14 days: ${trafficBlock.views14Days} page views from ${trafficBlock.visitors14Days} visitors; ${trafficBlock.clones14Days} clones from ${trafficBlock.cloners14Days} cloners.`
  : '- Not accessible to the agents (GitHub shows it only to the owner: the repository\'s Insights tab, then Traffic, last 14 days only).', '');
p('## Support', '', support ? `- ${support.waiting} draft(s) waiting; mailbox last checked ${support.checked}.` : '- Not switched on.', '');
p('## Not measurable', '', '- Who reads, which stories are finished, Drink Me, the rabbit hole, the Looking-Glass, Jars, the Caucus-race, streaks, and how many people have the app installed. The app sends nothing (D-005, D-011).', '');
if (unavailable.length) p(`**Could not be reached this time:** ${unavailable.join('; ')}.`, '');
console.log(out.join('\n'));

if (!args.includes('--no-save')) {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, `${today}.json`), JSON.stringify(data, null, 2) + '\n');
  console.log(`(saved to reports/data/${today}.json)`);
}
