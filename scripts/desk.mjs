#!/usr/bin/env node
// The editor's desk: one GitHub issue that always shows what is waiting for Carl,
// plus the tickets that tell him when a story is unchecked, held or missing.
// Run by .github/workflows/desk.yml. It reads the repository and GitHub, and
// writes only to GitHub issues; it never changes a file.
//
// Usage: node scripts/desk.mjs [--dry-run] [--now 2026-11-12T06:50:00Z]
//
// Environment (set by the workflow):
//   GITHUB_TOKEN, GITHUB_REPOSITORY   who and where
//   DESK_REHEARSAL=1                  rehearsal: label everything "rehearsal", notify nobody
//   DESK_VIA_GH=1                     call the API through the gh command (for testing by hand)
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { root, loadStories, londonNow, pad } from './lib/state.mjs';

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

// ---------- GitHub ----------
async function api(method, path, body) {
  if (process.env.DESK_VIA_GH) {
    const r = spawnSync('gh', ['api', '-X', method, path, ...(body ? ['--input', '-'] : [])], {
      input: body ? JSON.stringify(body) : undefined,
      encoding: 'utf8',
    });
    if (r.status !== 0) throw new Error(`${method} ${path}: ${r.stdout || r.stderr}`);
    return r.stdout ? JSON.parse(r.stdout) : null;
  }
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'curiouser-desk',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
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
function newestFile(dir, pattern) {
  const d = join(root, dir);
  if (!existsSync(d)) return null;
  const files = readdirSync(d).filter((f) => pattern.test(f)).sort();
  return files.length ? files.at(-1) : null;
}

async function gather(stories, uk, tickets) {
  const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const [pulls, failures, videos] = await Promise.all([
    quiet(() => read(`/repos/${repo}/pulls?state=open&per_page=30`), []),
    quiet(() => read(`/repos/${repo}/actions/runs?status=failure&created=${encodeURIComponent(`>${since}`)}&per_page=20`), { workflow_runs: [] }),
    quiet(() => read(`/repos/${repo}/releases/tags/videos`), null),
  ]);
  const support = existsSync(join(root, 'support', 'status.json')) ? JSON.parse(readFileSync(join(root, 'support', 'status.json'), 'utf8')) : null;
  const report = newestFile('reports', /^\d{4}-\d{2}-\d{2}\.md$/);
  return { pulls, failures: failures.workflow_runs ?? [], videos, support, report };
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

function render(stories, uk, tickets, g) {
  const waiting = [];
  for (const t of tickets) {
    if (t.kind === 'unchecked') waiting.push(`**Unchecked story:** [${t.title.replace(tag, '')}](${t.url}). Close that ticket to publish it.`);
    if (t.kind === 'held') waiting.push(`**Held story:** [${t.title.replace(tag, '')}](${t.url}).`);
    if (t.kind === 'missing') waiting.push(`**No story today:** [what happened](${t.url}).`);
  }
  for (const s of stories.filter((s) => s.status === 'released' && s.check.problems?.length)) {
    waiting.push(
      `**No. ${s.id} ${quote(s.title)} has ${plural(s.check.problems.length, 'open problem')}** the fact-checker couldn't fix: ` +
        s.check.problems.map((p) => `${p.where}: ${p.problem}`).join(' · ') +
        ` ([the check](${web}/blob/${branch}/content/checks/${pad(s.id)}.json))`,
    );
  }

  // The video to post.
  const assets = g.videos?.assets ?? [];
  const mp4 = assets.filter((a) => /^curiouser-\d{4}\.mp4$/.test(a.name)).sort((a, b) => a.name.localeCompare(b.name)).at(-1);
  let video = '🎬 **Video:** none yet.';
  if (mp4) {
    const id = Number(/(\d{4})/.exec(mp4.name)[1]);
    const story = stories.find((s) => s.id === id);
    const find = (suffix) => assets.find((a) => a.name === `curiouser-${pad(id)}${suffix}`);
    const days = Math.floor((now - new Date(mp4.updated_at)) / 86400000);
    const links = [
      `[download the video](${mp4.browser_download_url})`,
      find('-caption.txt') && `[caption to paste](${find('-caption.txt').browser_download_url})`,
      find('.srt') && `[captions file](${find('.srt').browser_download_url})`,
    ].filter(Boolean).join(' · ');
    video = `🎬 **Video** for No. ${id}${story ? ` ${quote(story.title)}` : ''}, made ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}: ${links}`;
    if (days <= 2) waiting.push(`**Video to post** for No. ${id}: ${links}. Nothing is posted for you.`);
  }

  // Pull requests: the Developer's work, waiting for approval.
  const prs = g.pulls.map((p) => `[#${p.number} ${p.title}](${p.html_url})`);
  for (const p of g.pulls) waiting.push(`**Pull request** [#${p.number} ${p.title}](${p.html_url}). Merging it is your approval, and sends it to readers' phones.`);

  // Support.
  let support = '✉️ **Support:** not switched on. It needs an address for readers to write to.';
  if (g.support) {
    support = g.support.waiting
      ? `✉️ **Support:** ${plural(g.support.waiting, 'reply', 'replies')} drafted and waiting in the mailbox's Drafts folder. Nothing is sent for you.`
      : `✉️ **Support:** nothing waiting (checked ${fmtDate(g.support.checked.slice(0, 10))}).`;
    if (g.support.waiting) waiting.push(`**Support:** ${plural(g.support.waiting, 'reply', 'replies')} drafted. Open the mailbox's Drafts folder, edit and send.`);
  }

  // Weekly report.
  let report = '📊 **Weekly report:** the first one arrives on Monday.';
  if (g.report) {
    const date = g.report.slice(0, 10);
    const age = Math.floor((new Date(`${uk.date}T12:00:00Z`) - new Date(`${date}T12:00:00Z`)) / 86400000);
    report = `📊 **Weekly report:** [${fmtDate(date)}](${web}/blob/${branch}/reports/${g.report})`;
    if (age <= 2) waiting.push(`**Weekly report** for ${fmtDate(date)}: [read it](${web}/blob/${branch}/reports/${g.report}).`);
  }

  const failed = g.failures.map((r) => `[${r.name}](${r.html_url}) at ${ukClock(r.created_at)}`);

  return [
    `<!-- curiouser:desk -->`,
    ...banner,
    `**${fmtDate(uk.date)}**, as of ${uk.clock}.`,
    '',
    todayLine(stories, uk, tickets),
    '',
    `## Waiting for you${waiting.length ? ` (${waiting.length})` : ''}`,
    '',
    ...(waiting.length ? waiting.map((w) => `- ${w}`) : ['Nothing. All clear.']),
    '',
    '## Everything else',
    '',
    `- ${video}`,
    `- 🔧 **Pull requests:** ${prs.length ? prs.join(' · ') : 'none open.'}`,
    `- ${support}`,
    `- ${report}`,
    `- 🩺 **Automation that failed in the last day:** ${failed.length ? failed.join(' · ') : 'none.'}`,
    '',
    '---',
    `*This page rewrites itself whenever something changes. How the team works: [agents/README.md](${web}/blob/${branch}/agents/README.md). Ideas backlog: [IDEAS.md](${web}/blob/${branch}/IDEAS.md).*`,
  ].join('\n');
}

async function syncDesk(body, uk, summary) {
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
  if (!number || uk.minutes < PING_FROM || uk.minutes > PING_UNTIL) return;
  const comments = await read(`/repos/${repo}/issues/${number}/comments?per_page=100`);
  const pings = comments.filter((c) => /<!-- curiouser:ping \d{4}-\d{2}-\d{2} -->/.test(c.body));
  if (pings.some((c) => c.body.includes(`<!-- curiouser:ping ${uk.date} -->`))) return;
  for (const old of pings) await write('DELETE', `/repos/${repo}/issues/comments/${old.id}`, null, `removed an old morning note`);
  const hello = rehearsal ? 'Morning note (rehearsal, nobody notified).' : `@${owner} good morning.`;
  await write('POST', `/repos/${repo}/issues/${number}/comments`, { body: `<!-- curiouser:ping ${uk.date} -->\n${hello} ${summary}` }, `sent the morning note: ${summary}`);
}

// ---------- Run ----------
const uk = londonNow(now);
const { stories } = loadStories();
if (!dryRun) {
  for (const [name, color, description] of [
    ['release-ticket', 'B60205', 'A story that needs the editor-in-chief'],
    ['desk', '1D1D1B', "The editor's desk"],
    ...(rehearsal ? [['rehearsal', 'C5DEF5', 'A practice run. Nothing here is real.']] : []),
  ]) {
    await quiet(() => api('POST', `/repos/${repo}/labels`, { name, color, description }).catch((e) => { if (!/already_exists/.test(e.message)) throw e; }));
  }
}
const tickets = await syncTickets(stories, uk);
const g = await gather(stories, uk, tickets);
const body = render(stories, uk, tickets, g);
const waitingCount = (body.match(/^## Waiting for you \((\d+)\)/m) ?? [])[1] ?? '0';
const first = todayLine(stories, uk, tickets).split('\n')[0].replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/ → what to do/, '');
const summary = `${first} ${waitingCount === '0' ? 'Nothing is waiting for you.' : `${plural(Number(waitingCount), 'thing')} waiting for you above.`}`;
if (dryRun) console.log(`\n----- desk -----\n${body}\n----- morning note -----\n${summary}\n`);
await syncDesk(body, uk, summary);
