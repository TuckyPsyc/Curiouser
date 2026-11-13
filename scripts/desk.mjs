#!/usr/bin/env node
// The editor's desk: one GitHub issue that always shows what is waiting for Carl,
// plus the tickets that tell him when a story is unchecked, held or missing.
// Run by .github/workflows/desk.yml (and by release.yml after a release).
//
// Each run it:
//   - raises or closes release tickets,
//   - assigns Carl to any new request on his queue (label needs-carl, opened by
//     scripts/ask-carl.mjs), which is what notifies him,
//   - rewrites the desk around the ranked queue and the agents' health,
//   - once a day after 06:45, sends the morning note, signed by Fenton,
//   - writes the status page (status.md and status.json) and force-pushes it to
//     the `status` branch, which nothing else uses and which starts no workflows.
// It never changes a file on main.
//
// Usage: node scripts/desk.mjs [--dry-run] [--now 2026-11-12T06:50:00Z]
//
// Environment (set by the workflow):
//   GITHUB_TOKEN, GITHUB_REPOSITORY   who and where
//   DESK_REHEARSAL=1                  rehearsal: label everything "rehearsal", notify nobody,
//                                     and write the status page to `status-rehearsal`
//   DESK_VIA_GH=1                     call the API through the gh command (for testing by hand)
//   STATUS_REMOTE                     where to push the status page (tests only)
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { root, loadStories, londonNow, pad } from './lib/state.mjs';
import { github, trusted } from './lib/github.mjs';
import { buildQueue, totalMinutes, TEAM, requestAgent, requestState, requestLabel } from './lib/queue.mjs';
import { agentHealth, healthIcon } from './lib/health.mjs';
import { fentonState, fentonLine } from './lib/fenton.mjs';
import { renderStatus, plain } from './lib/status.mjs';
import { mondayOf, dueWords, ukOf } from './lib/dates.mjs';

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
const dryRun = flag('--dry-run');
const now = opt('--now') ? new Date(opt('--now')) : new Date();
const rehearsal = process.env.DESK_REHEARSAL === '1' || process.env.DESK_REHEARSAL === 'true';
const repo = process.env.GITHUB_REPOSITORY || 'TuckyPsyc/curiouser';
const owner = repo.split('/')[0];
const branch = process.env.DESK_BRANCH || 'main';
const web = `https://github.com/${repo}`;
const tag = rehearsal ? '[Rehearsal] ' : '';
const banner = rehearsal ? ['> **This is a practice run.** Nothing here is real, readers are not affected, and there is nothing for you to do.', ''] : [];

// When the alarm for an unchecked or missing story goes off (UK time). The
// fact-checker starts at 05:40 and normally finishes within half an hour.
const ALARM_MINUTES = 6 * 60 + 30;
// The morning note is sent once a day, the first time this runs after 06:45 UK.
const PING_FROM = 6 * 60 + 45;
const PING_UNTIL = 11 * 60;

// The status page lives on a branch of its own, so it can be rewritten every run
// without a commit on main: raw.githubusercontent.com/<repo>/status/status.md
const STATUS_BRANCH = rehearsal ? 'status-rehearsal' : 'status';

// ---------- GitHub ----------
const api = github({ useGh: Boolean(process.env.DESK_VIA_GH) });
const read = (path) => api('GET', path);
const write = async (method, path, body, what) => {
  console.log(`${dryRun ? 'would' : 'did'}: ${what}`);
  return dryRun ? null : api(method, path, body);
};
const quiet = async (fn, fallback) => {
  try {
    return await fn();
  } catch (e) {
    // "Not found" is an ordinary answer here (no videos yet, say), not a fault.
    if (!/Not Found|HTTP 404/.test(e.message)) console.log(`(skipped: ${e.message.split('\n')[0].slice(0, 160)})`);
    return fallback;
  }
};

// ---------- Words ----------
const fmtDate = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const ukClock = (iso) => londonNow(new Date(iso)).clock;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const marker = (kind, key) => `<!-- curiouser:ticket kind=${kind} story=${key} -->`;
const parseMarker = (body) => /<!-- curiouser:ticket kind=(\w+) story=([\w-]+) -->/.exec(body ?? '');
const quote = (s) => `“${s}”`;

/** A story as Markdown, so Carl can read a draft on his phone before deciding. */
function storyMarkdown(issue) {
  const lg = issue.lookingGlass;
  const lines = [
    `### No. ${issue.id} · ${issue.topic} · ${issue.title}`,
    `*The idea: ${issue.concept}*`,
    '',
    ...issue.story.flatMap((p) => [p, '']),
    `**Drink Me:** ${issue.takeaway}`,
    '',
    `**Through the Looking-Glass** (${lg.kind}, rated ${lg.confidence}): *${lg.heading}*`,
    '',
    ...lg.body.flatMap((p) => [p, '']),
    lg.verdict,
    '',
    '<details><summary>The rabbit hole, the quiz and the sources</summary>',
    '',
    `**${issue.rabbitHole.title}.** ${issue.rabbitHole.intro}`,
    '',
    ...issue.rabbitHole.levels.flatMap((l) => [`**${l.heading}**`, '', ...l.body.flatMap((p) => [p, ''])]),
    '**Quiz**',
    '',
    ...issue.quiz.flatMap((q) => [`- ${q.question} *Answer: ${q.options[q.answer]}*`]),
    '',
    '**Sources**',
    '',
    ...issue.sources.map((s) => (s.url ? `- [${s.title}](${s.url})` : `- ${s.title}`)),
    '',
    '</details>',
  ];
  return lines.join('\n');
}

// ---------- Tickets ----------
// One ticket per story that needs Carl. Closing an "unchecked" ticket as completed
// is his one-tap release (see release.yml). The other kinds are for information.
function ticketsWanted(stories, uk) {
  const wanted = [];
  for (const s of stories) {
    if (s.status === 'held') {
      const c = s.check;
      wanted.push({
        kind: 'held',
        key: String(s.id),
        title: `${tag}Held: No. ${s.id} ${quote(s.title)}`,
        body: [
          marker('held', s.id),
          ...banner,
          `The fact-checker held this story back at ${ukClock(c.at)} on ${fmtDate(londonNow(new Date(c.at)).date)}. Readers can't see it, and the last released story stays in place.`,
          '',
          `**Why:** ${c.summary}`,
          '',
          ...c.problems.map((p) => `- **${p.where}:** ${p.problem}`),
          '',
          '**What you can do**',
          '- **Nothing.** The next story follows as usual, and this one stays unpublished. Close this ticket when you\'ve read it.',
          `- **Have it fixed.** Open Claude, choose this project and say: "Fix No. ${s.id} using the fact-checker's notes, then re-check it."`,
          `- **Publish it anyway.** In the GitHub app, open this repository, tap **Actions**, **Release a story**, **Run workflow**, type ${s.id} and run it. Closing this ticket does not publish it.`,
          '',
          '---',
          '',
          storyMarkdown(s.issue),
        ].join('\n'),
      });
    } else if (s.status === 'draft' && (s.date < uk.date || (s.date === uk.date && uk.minutes >= ALARM_MINUTES))) {
      wanted.push({
        kind: 'unchecked',
        key: String(s.id),
        title: `${tag}Release No. ${s.id} unchecked? ${quote(s.title)}`,
        body: [
          marker('unchecked', s.id),
          ...banner,
          `The story for ${fmtDate(s.date)} has **not been fact-checked**: the fact-checker failed or didn't run. Readers can't see it, and the last released story stays in place.`,
          '',
          '**What you can do**',
          '- **Publish it unchecked: close this issue.** Tap **Close issue** (as completed). It reaches readers within about five minutes.',
          '- **Keep it back: do nothing.** The fact-checker tries again at its next run, and this ticket closes itself once the story is checked.',
          '- **Dismiss this ticket without publishing:** close it as **not planned**.',
          '',
          'The story is below so you can read it first.',
          '',
          '---',
          '',
          storyMarkdown(s.issue),
        ].join('\n'),
      });
    }
  }
  // No story at all today: the Editor failed or didn't run.
  const todays = stories.some((s) => s.date === uk.date);
  if (!todays && uk.minutes >= ALARM_MINUTES) {
    wanted.push({
      kind: 'missing',
      key: uk.date,
      title: `${tag}No story for ${fmtDate(uk.date)}`,
      body: [
        marker('missing', uk.date),
          ...banner,
        `The Editor hasn't written today's story. Readers see the last released story instead.`,
        '',
        '**What you can do**',
        '- **Nothing.** The Editor runs again tomorrow at 04:47.',
        '- **Run it now.** In the Claude app, open **Scheduled**, choose **Curiouser: Before Breakfast story** and tap **Run now**. The fact-checker then needs running the same way.',
        '',
        'This ticket closes itself when a story for today appears.',
      ].join('\n'),
    });
  }
  return wanted;
}

async function syncTickets(stories, uk) {
  const wanted = ticketsWanted(stories, uk);
  const all = (await read(`/repos/${repo}/issues?labels=release-ticket&state=all&per_page=100`)).filter(
    (i) => !i.pull_request && i.labels.some((l) => l.name === 'rehearsal') === rehearsal,
  );
  const existing = all.map((i) => ({ issue: i, m: parseMarker(i.body) })).filter((x) => x.m);
  const find = (kind, key) => existing.filter((x) => x.m[1] === kind && x.m[2] === key);
  const open = [];

  for (const t of wanted) {
    const same = find(t.kind, t.key);
    const live = same.find((x) => x.issue.state === 'open');
    if (live) {
      if (live.issue.body !== t.body || live.issue.title !== t.title) {
        await write('PATCH', `/repos/${repo}/issues/${live.issue.number}`, { title: t.title, body: t.body }, `updated ticket #${live.issue.number} (${t.title})`);
      }
      open.push({ ...t, number: live.issue.number, url: live.issue.html_url });
    } else if (same.length) {
      // Carl closed it without releasing. He has seen it; don't raise it again.
      console.log(`ticket for ${t.kind} ${t.key} was dismissed (#${same[0].issue.number}); leaving it closed`);
    } else {
      const made = await write(
        'POST',
        `/repos/${repo}/issues`,
        { title: t.title, body: t.body, labels: ['release-ticket', ...(rehearsal ? ['rehearsal'] : [])], ...(rehearsal ? {} : { assignees: [owner] }) },
        `opened ticket: ${t.title}`,
      );
      open.push({ ...t, number: made?.number ?? 0, url: made?.html_url ?? `${web}/issues` });
    }
  }

  // Close tickets that no longer apply: the story was checked, released or written.
  for (const x of existing.filter((x) => x.issue.state === 'open')) {
    if (wanted.some((t) => t.kind === x.m[1] && t.key === x.m[2])) continue;
    const story = stories.find((s) => String(s.id) === x.m[2]);
    const why = !story
      ? x.m[1] === 'missing' ? 'A story for that day has now been written.' : 'That story no longer exists.'
      : story.status === 'released'
        ? `No. ${story.id} has now been released (${story.check.verdict}, by the ${story.check.by}).`
        : story.status === 'held'
          ? `The fact-checker has now checked No. ${story.id} and held it. See the new ticket.`
          : `No. ${story.id} is back with the fact-checker.`;
    await write('POST', `/repos/${repo}/issues/${x.issue.number}/comments`, { body: `${why} Closing this ticket.` }, `commented on #${x.issue.number}`);
    await write('PATCH', `/repos/${repo}/issues/${x.issue.number}`, { state: 'closed', state_reason: 'not_planned' }, `closed ticket #${x.issue.number}: ${why}`);
  }
  return open;
}

// ---------- The desk ----------
// The issue where Carl reports how each video did, read by the Marketing agent (agents/marketing.md).
const RESULTS_ISSUE = 8;
const listFiles = (dir, pattern) => {
  const d = join(root, dir);
  return existsSync(d) ? readdirSync(d).filter((f) => pattern.test(f)).sort() : [];
};
const newestFile = (dir, pattern) => listFiles(dir, pattern).at(-1) ?? null;

/** IDEAS.md items marked Ready, before the "Done" section. */
function readyIdeas() {
  const p = join(root, 'IDEAS.md');
  if (!existsSync(p)) return 0;
  const text = readFileSync(p, 'utf8').split(/^## Done/m)[0];
  return (text.match(/^\*\*Status:\*\*\s*Ready\b/gm) ?? []).length;
}

// Requests on Carl's queue. Agents act as Carl's own GitHub account, so their
// assigning him would notify nobody; the desk assigns him instead (D-020).
async function syncNeeds() {
  const open = (await read(`/repos/${repo}/issues?labels=needs-carl&state=open&per_page=100`)).filter(
    (i) => !i.pull_request && trusted(i) && i.labels.some((l) => l.name === 'rehearsal') === rehearsal,
  );
  for (const i of open) {
    if (rehearsal || i.assignees?.some((a) => a.login.toLowerCase() === owner.toLowerCase())) continue;
    await write('POST', `/repos/${repo}/issues/${i.number}/assignees`, { assignees: [owner] }, `assigned ${owner} to #${i.number} (${i.title})`);
  }
  return open;
}

// Carl's requests to agents (issues labelled for-<agent>), and whether each has been answered.
async function readRequests() {
  const open = (await read(`/repos/${repo}/issues?state=open&per_page=100`)).filter(
    (i) => !i.pull_request && trusted(i) && requestAgent(i) && i.labels.some((l) => l.name === 'rehearsal') === rehearsal,
  );
  const out = [];
  for (const i of open) {
    const comments = i.comments ? await read(`/repos/${repo}/issues/${i.number}/comments?per_page=100`) : [];
    out.push({ number: i.number, title: i.title, url: i.html_url, agent: requestAgent(i), ...requestState(comments) });
  }
  return out;
}

async function gather(stories, uk) {
  const day = new Date(now.getTime() - 24 * 3600 * 1000);
  const monday = mondayOf(uk.date);
  // One call covers both the last day and the week so far.
  const since = new Date(Math.min(day.getTime(), Date.parse(`${monday}T00:00:00Z`) - 3600 * 1000)).toISOString();
  const [pulls, recentPulls, failed, videos, needs, requests] = await Promise.all([
    quiet(() => read(`/repos/${repo}/pulls?state=open&per_page=30`), []),
    quiet(() => read(`/repos/${repo}/pulls?state=all&sort=created&direction=desc&per_page=30`), []),
    quiet(() => read(`/repos/${repo}/actions/runs?status=failure&created=${encodeURIComponent(`>${since}`)}&per_page=100`), { workflow_runs: [] }),
    quiet(() => read(`/repos/${repo}/releases/tags/${rehearsal ? 'videos-rehearsal' : 'videos'}`), null),
    quiet(() => syncNeeds(), []),
    quiet(() => readRequests(), []),
  ]);
  const runs = failed.workflow_runs ?? [];
  const support = existsSync(join(root, 'support', 'status.json')) ? JSON.parse(readFileSync(join(root, 'support', 'status.json'), 'utf8')) : null;
  const dated = /^\d{4}-\d{2}-\d{2}\.md$/;
  const reports = listFiles('reports', dated);
  const briefs = listFiles('marketing', dated);
  // The newest video, with the words to paste under it and a note of how it was made.
  let video = null;
  const assets = videos?.assets ?? [];
  const mp4s = assets.filter((a) => /^curiouser-\d{4}\.mp4$/.test(a.name)).sort((a, b) => a.name.localeCompare(b.name));
  const mp4 = mp4s.at(-1);
  if (mp4) {
    const stem = mp4.name.replace('.mp4', '');
    const asset = (suffix) => assets.find((a) => a.name === `${stem}${suffix}`);
    const text = (a) => (a ? quiet(async () => (await fetch(a.browser_download_url, { headers: { 'user-agent': 'curiouser-desk' } })).text(), null) : null);
    const [caption, made] = await Promise.all([text(asset('-caption.txt')), text(asset('.json'))]);
    let meta = null;
    try { meta = JSON.parse(made); } catch {}
    video = { id: Number(stem.slice(-4)), mp4, srt: asset('.srt'), captionFile: asset('-caption.txt'), caption: caption?.trim() || null, meta };
  }
  const devPulls = pulls.filter((p) => trusted(p)).length;
  return {
    pulls,
    recentPulls,
    failures: runs.filter((r) => new Date(r.created_at) >= day),
    weekFailures: runs.filter((r) => ukOf(r.created_at).date >= monday),
    video,
    rendered: new Set(mp4s.map((a) => Number(a.name.slice(-8, -4)))),
    madeThisWeek: mp4s.filter((a) => ukOf(a.updated_at).date >= monday).length,
    scripts: new Set(listFiles('videos', /^\d{4}\.json$/).map((f) => Number(f.slice(0, 4)))),
    needs,
    requests,
    support,
    report: reports.at(-1) ?? null,
    reports: reports.map((f) => f.slice(0, 10)),
    brief: briefs.at(-1) ?? null,
    briefs: briefs.map((f) => f.slice(0, 10)),
    ready: Math.max(0, readyIdeas() - devPulls),
  };
}

/** The week so far, Monday to today: only what can be counted (D-018). */
function weekNumbers(stories, uk, g) {
  const monday = mondayOf(uk.date);
  const inWeek = stories.filter((s) => s.date >= monday && s.date <= uk.date);
  const checks = stories.filter((s) => s.check?.by === 'fact-checker' && s.check.at && ukOf(s.check.at).date >= monday);
  return {
    from: monday,
    to: uk.date,
    released: inWeek.filter((s) => s.status === 'released').length,
    held: inWeek.filter((s) => s.status === 'held').length,
    drafts: inWeek.filter((s) => s.status === 'draft').length,
    checks: checks.length,
    corrected: checks.filter((s) => s.check.verdict === 'fixed').length,
    corrections: checks.reduce((n, s) => n + (s.check.changes?.length ?? 0), 0),
    videos: g.madeThisWeek,
    prsOpened: g.recentPulls.filter((p) => ukOf(p.created_at).date >= monday).length,
    prsMerged: g.recentPulls.filter((p) => p.merged_at && ukOf(p.merged_at).date >= monday).length,
    failedRuns: g.weekFailures.length,
  };
}

function todayLine(stories, uk, tickets) {
  const todays = stories.filter((s) => s.date === uk.date).at(-1);
  const ticketFor = (kind, key) => tickets.find((t) => t.kind === kind && t.key === String(key));
  const link = (t) => (t ? ` → [what to do](${t.url})` : '');
  if (!todays) {
    return uk.minutes < ALARM_MINUTES
      ? `⏳ **Today's story** isn't written yet. The Editor runs at 04:47 and the fact-checker at 05:40.`
      : `⛔ **No story today.** The Editor didn't publish, so readers see the last released story.${link(ticketFor('missing', uk.date))}`;
  }
  const head = `**No. ${todays.id}, ${quote(todays.title)}** (${todays.concept})`;
  const c = todays.check;
  const checkLink = `[the check](${web}/blob/${branch}/content/checks/${pad(todays.id)}.json)`;
  if (todays.status === 'released' && c.by === 'fact-checker') {
    const counts = `${plural(c.claims?.checked ?? 0, 'claim')} and ${plural(c.links?.checked ?? 0, 'link')} checked`;
    if (c.verdict === 'pass') return `✅ ${head} was checked and released at ${ukClock(c.at)}. ${counts}, nothing changed. See ${checkLink}.`;
    return [
      `✅ ${head} was checked, corrected and released at ${ukClock(c.at)}. ${counts}, ${plural(c.changes.length, 'change')}. See ${checkLink}.`,
      ...c.changes.map((ch) => `  - ${ch.where}: ${quote(ch.before)} → ${quote(ch.after)}. ${ch.why}`),
    ].join('\n');
  }
  if (todays.status === 'released' && c.by === 'launch') return `☑️ ${head} went out before the fact-checker existed, and is waiting for its first check.`;
  if (todays.status === 'released') return `⚠️ ${head} was released **unchecked** by the ${c.by} at ${ukClock(c.at)}.`;
  if (todays.status === 'held') return `⛔ ${head} is **held**: ${c.summary}${link(ticketFor('held', todays.id))}`;
  return uk.minutes < ALARM_MINUTES
    ? `⏳ ${head} is written and waiting for the fact-checker (05:40).`
    : `⚠️ ${head} has **not been checked**. Readers can't see it.${link(ticketFor('unchecked', todays.id))}`;
}


/** One queue item as a line on the desk: what, how long, and the one step to take. */
function itemMarkdown(i, uk) {
  const facts = [
    `${i.minutes} min`,
    i.blocks && `blocks: ${i.blocks}`,
    i.by && dueWords(i.by, uk.date),
    i.optional && 'optional',
  ].filter(Boolean);
  const link = i.url ? ` [${i.number ? `#${i.number}` : 'Open'}](${i.url})` : '';
  return `${i.blocks ? '⛔ ' : ''}**${i.title}** · ${facts.join(' · ')}. ${i.how}${link}`;
}

function render(stories, uk, g, queue, health) {
  // The video to post.
  let video = '🎬 **Video:** none yet.';
  let videoCaption = [];
  if (g.video) {
    const { id, mp4, srt, captionFile, caption, meta } = g.video;
    const story = stories.find((s) => s.id === id);
    // Count calendar days in the UK, so a video made last night says "yesterday".
    const days = Math.round((Date.parse(`${uk.date}T12:00:00Z`) - Date.parse(`${ukOf(mp4.updated_at).date}T12:00:00Z`)) / 86400000);
    const how = meta
      ? ` (${Math.round(meta.seconds)} seconds; ${meta.voice === 'none' ? 'captions only, no voice' : meta.voice === 'elevenlabs' ? 'your ElevenLabs voice' : 'the free AI voice'})`
      : '';
    const links = [
      `[download the video](${mp4.browser_download_url})`,
      srt && `[captions file](${srt.browser_download_url})`,
      captionFile && !caption && `[caption to paste](${captionFile.browser_download_url})`,
    ].filter(Boolean).join(' · ');
    video = `🎬 **Video** for No. ${id}${story ? ` ${quote(story.title)}` : ''}, made ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}${how}: ${links}`;
    if (now - new Date(mp4.updated_at) < 2 * 86400000 && caption) {
      videoCaption = ['', `### Caption to paste under the video for No. ${id}`, '', 'Press and hold to select it, then copy.', '', '```', caption.replace(/```/g, "'''"), '```'];
    }
  }

  const prs = g.pulls.map((p) => (trusted(p) ? `[#${p.number} ${p.title}](${p.html_url})` : `[#${p.number}, from outside the team](${p.html_url})`));

  let support = '✉️ **Support:** not switched on. It needs an address for readers to write to.';
  if (g.support) {
    support = g.support.waiting
      ? `✉️ **Support:** ${plural(g.support.waiting, 'reply', 'replies')} drafted and waiting in the mailbox's Drafts folder. Nothing is sent for you.`
      : `✉️ **Support:** nothing waiting (checked ${fmtDate(g.support.checked.slice(0, 10))}).`;
  }

  const report = g.report
    ? `📊 **Weekly report:** [${fmtDate(g.report.slice(0, 10))}](${web}/blob/${branch}/reports/${g.report})`
    : '📊 **Weekly report:** the first one arrives on Monday.';

  const resultsIssue = `${web}/issues/${RESULTS_ISSUE}`;
  const brief = g.brief
    ? `📣 **Marketing brief:** [${fmtDate(g.brief.slice(0, 10))}](${web}/blob/${branch}/marketing/${g.brief}). Report how posts did in [How the posts did](${resultsIssue}).`
    : `📣 **Marketing:** the first brief arrives on Sunday. Report how posts did in [How the posts did](${resultsIssue}).`;

  const failed = g.failures.map((r) => `[${r.name}](${r.html_url}) at ${ukClock(r.created_at)}`);
  const total = totalMinutes(queue);

  return [
    `<!-- curiouser:desk -->`,
    ...banner,
    `**${fmtDate(uk.date)}**, as of ${uk.clock}.`,
    '',
    todayLine(stories, uk, g.tickets),
    '',
    `## Waiting for you${queue.length ? ` (${queue.length}, about ${total} min)` : ''}`,
    '',
    ...(queue.length
      ? [...queue.map((i) => `${i.rank}. ${itemMarkdown(i, uk)}`), '', '*Blocking things first, then deadlines, then the quickest. To answer a request, comment on it if there is anything to say, then close it. Closing as "not planned" means no.*']
      : ['Nothing. All clear.']),
    '',
    '## The agents',
    '',
    ...health.map((h) => `- ${healthIcon[h.state]} **${h.agent}:** ${h.state === 'not-due' ? `not due: ${h.text}` : h.text}`),
    '',
    '## Everything else',
    '',
    `- ${video}`,
    `- 🔧 **Pull requests:** ${prs.length ? prs.join(' · ') : 'none open.'}`,
    `- ${support}`,
    `- ${report}`,
    `- ${brief}`,
    `- 🩺 **Automation that failed in the last day:** ${failed.length ? failed.join(' · ') : 'none.'}`,
    `- 🎩 **Status page, for Fenton:** [status.md](https://raw.githubusercontent.com/${repo}/${STATUS_BRANCH}/status.md)`,
    ...videoCaption,
    '',
    '---',
    `*This page rewrites itself whenever something changes. How the team works: [agents/README.md](${web}/blob/${branch}/agents/README.md). Ideas backlog: [IDEAS.md](${web}/blob/${branch}/IDEAS.md).*`,
  ].join('\n');
}

async function syncDesk(body, uk, summary, line) {
  const label = rehearsal ? 'rehearsal' : 'desk';
  const found = (await read(`/repos/${repo}/issues?labels=${label}&state=open&per_page=30`)).find((i) => (i.body ?? '').includes('<!-- curiouser:desk -->'));
  let number = found?.number;
  // Compare without the "as of" clock, so a run that changes nothing writes nothing.
  const strip = (s) => (s ?? '').replace(/, as of \d\d:\d\d\./, '');
  if (!found) {
    const made = await write('POST', `/repos/${repo}/issues`, { title: `${tag}The editor's desk`, body, labels: [label] }, 'opened the desk');
    number = made?.number;
  } else if (strip(found.body) !== strip(body)) {
    await write('PATCH', `/repos/${repo}/issues/${number}`, { body }, `updated the desk (#${number})`);
  } else {
    console.log('desk unchanged');
  }

  // Keep the desk pinned to the top of the repository's Issues page.
  if (number && !rehearsal && !dryRun) {
    await quiet(async () => {
      const [o, n] = repo.split('/');
      const q = await api('POST', '/graphql', { query: `query { repository(owner: "${o}", name: "${n}") { issue(number: ${number}) { id isPinned } } }` });
      const issue = q?.data?.repository?.issue;
      if (!issue) return console.log(`could not read whether the desk is pinned: ${JSON.stringify(q).slice(0, 200)}`);
      if (issue.isPinned) return;
      const r = await api('POST', '/graphql', { query: `mutation { pinIssue(input: { issueId: "${issue.id}" }) { issue { number } } }` });
      console.log(r?.errors ? `could not pin the desk: ${r.errors[0].message}` : 'pinned the desk');
    });
  }

  // The morning note: one comment a day that mentions Carl, so his phone buzzes once.
  if (number && uk.minutes >= PING_FROM && uk.minutes <= PING_UNTIL) {
    const comments = await read(`/repos/${repo}/issues/${number}/comments?per_page=100`);
    const pings = comments.filter((c) => /<!-- curiouser:ping \d{4}-\d{2}-\d{2} -->/.test(c.body));
    if (!pings.some((c) => c.body.includes(`<!-- curiouser:ping ${uk.date} -->`))) {
      for (const old of pings) await write('DELETE', `/repos/${repo}/issues/comments/${old.id}`, null, `removed an old morning note`);
      const hello = rehearsal ? 'Morning note (rehearsal, nobody notified).' : `@${owner} good morning.`;
      await write(
        'POST',
        `/repos/${repo}/issues/${number}/comments`,
        { body: `<!-- curiouser:ping ${uk.date} -->\n${hello} ${summary}\n\n> *${line}*\n>\n> Fenton` },
        `sent the morning note: ${summary}`,
      );
    }
  }
  return number;
}

// The status page goes to a branch of its own as a single commit, replaced each
// time. A push made with the workflow's token starts no workflows, every workflow
// that runs on a push names its branches (main, rehearsal) so none would match
// anyway, and "[skip ci]" is belt and braces. scripts/test-gate.mjs checks all three.
function publishStatus(st, uk) {
  if (dryRun) return console.log(`would: publish the status page to ${STATUS_BRANCH} (${st.words} words)`);
  const token = process.env.GITHUB_TOKEN;
  const remote = process.env.STATUS_REMOTE || (token ? `https://github.com/${repo}.git` : null);
  if (!remote) return console.log('(status page not published: no GITHUB_TOKEN)');
  const dir = mkdtempSync(join(tmpdir(), 'curiouser-status-'));
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  if (token && !process.env.STATUS_REMOTE) {
    // The token goes in a header, as actions/checkout does it, never in the address.
    Object.assign(env, {
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
      GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`,
    });
  }
  const git = (...a) => {
    const r = spawnSync('git', a, { cwd: dir, encoding: 'utf8', env });
    if (r.status !== 0) throw new Error(`git ${a[0]}: ${(r.stderr || r.stdout).trim().split('\n')[0]}`);
  };
  try {
    writeFileSync(join(dir, 'status.md'), st.md);
    writeFileSync(join(dir, 'status.json'), st.json);
    git('init', '-q', '-b', STATUS_BRANCH);
    git('config', 'user.name', 'github-actions[bot]');
    git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
    git('config', 'commit.gpgsign', 'false');
    git('add', 'status.md', 'status.json');
    git('commit', '-q', '-m', `Status at ${uk.date} ${uk.clock} UK [skip ci]`);
    git('push', '-q', '--force', remote, `HEAD:refs/heads/${STATUS_BRANCH}`);
    console.log(`did: published the status page to ${STATUS_BRANCH} (${st.words} words)`);
  } catch (e) {
    // Fail the run, so it shows on the desk as failed automation, but only after the desk is up to date.
    console.log(`✗ status page not published: ${token ? e.message.replaceAll(token, '***') : e.message}`);
    process.exitCode = 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- Run ----------
const uk = londonNow(now);
const { stories } = loadStories();
if (!dryRun) {
  for (const [name, color, description] of [
    ['release-ticket', 'B60205', 'A story that needs the editor-in-chief'],
    ['desk', '1D1D1B', "The editor's desk"],
    ['needs-carl', 'D93F0B', 'Waiting for Carl'],
    ...Object.entries(TEAM).map(([agent, who]) => [requestLabel(agent), 'BFD4F2', `A request from Carl for ${who}`]),
    ...(rehearsal ? [['rehearsal', 'C5DEF5', 'A practice run. Nothing here is real.']] : []),
  ]) {
    await quiet(() => api('POST', `/repos/${repo}/labels`, { name, color, description }).catch((e) => { if (!/already_exists/.test(e.message)) throw e; }));
  }
}
const tickets = await syncTickets(stories, uk);
const g = { ...(await gather(stories, uk)), tickets };
const problems = stories
  .filter((s) => s.status === 'released' && s.check.problems?.length)
  .map((s) => ({ ...s, checkUrl: `${web}/blob/${branch}/content/checks/${pad(s.id)}.json` }));
const queue = buildQueue({
  uk,
  now,
  tickets,
  needs: g.needs,
  requests: g.requests,
  pulls: g.pulls,
  video: g.video && { id: g.video.id, made: g.video.mp4.updated_at, url: g.video.mp4.browser_download_url, warnings: g.video.meta?.warnings },
  support: g.support,
  report: g.report,
  brief: g.brief,
  problems,
  urls: {
    report: g.report && `${web}/blob/${branch}/reports/${g.report}`,
    brief: g.brief && `${web}/blob/${branch}/marketing/${g.brief}`,
  },
});
const health = agentHealth({ uk, stories, scripts: g.scripts, rendered: g.rendered, briefs: g.briefs, reports: g.reports, pulls: g.recentPulls, ready: g.ready, failures: g.failures });
const state = fentonState({ health, queue, date: uk.date });
const line = fentonLine(state, uk.date);
const body = render(stories, uk, g, queue, health);

const today = plain(todayLine(stories, uk, tickets).split('\n')[0]).replace(/ → what to do/, '').replace(/ See the check\./, '');
const fails = health.filter((h) => h.state === 'fail');
const summary = [
  today,
  queue.length
    ? `${plural(queue.length, 'thing')} waiting for you, about ${totalMinutes(queue)} min. First: ${queue[0].title} (${queue[0].minutes} min).`
    : 'Nothing is waiting for you.',
  fails.length ? `${fails.length === 1 ? 'One agent problem' : `${fails.length} agent problems`}: ${fails.map((f) => f.agent).join(', ')}.` : '',
].filter(Boolean).join(' ');

const deskNumber = await syncDesk(body, uk, summary, line);
const status = renderStatus({
  uk,
  now,
  rehearsal,
  fenton: { state, line },
  health,
  queue,
  // Only the first sentence: the corrections are on the desk.
  today: today.split(/(?<!No)\.\s/)[0].replace(/\.?$/, '.'),
  week: weekNumbers(stories, uk, g),
  waiting: (g.requests ?? []).filter((r) => !r.answered),
  deskUrl: deskNumber ? `${web}/issues/${deskNumber}` : `${web}/issues`,
});
if (dryRun) console.log(`\n----- desk -----\n${body}\n----- morning note -----\n${summary}\n> ${line} — Fenton\n----- status.md (${status.words} words) -----\n${status.md}`);
publishStatus(status, uk);
