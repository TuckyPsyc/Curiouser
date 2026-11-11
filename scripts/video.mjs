#!/usr/bin/env node
// The Producer's helper. It doesn't make the video (scripts/video/render.py
// does, on GitHub); it says which story to film and checks a video script
// before it is saved.
//
// Usage:
//   node scripts/video.mjs next [--story N]   which story to film next, as JSON
//   node scripts/video.mjs check [file…]      check video scripts (all of videos/ if none named)
//   node scripts/video.mjs pictures           list the pictures a script may use
//   node scripts/video.mjs wait N             after saving the script for No. N, wait for GitHub to make the video
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { root, loadStories, londonNow, pad } from './lib/state.mjs';

const videosDir = join(root, 'videos');
const art = JSON.parse(readFileSync(join(root, 'scripts', 'video', 'art.json'), 'utf8'));
export const SIGN_OFF = 'Curiouser: get curiouser before breakfast.';

// How fast the narrator speaks, measured from real renders, and the pauses the
// renderer adds. Used to estimate a script's length before it is rendered.
const CHARS_PER_SECOND = 17;
const PAUSES = (lines) => 0.2 + 1.1 + 0.5 + 0.32 * Math.max(0, lines - 2);
const MAX_SECONDS = 60;

const scriptPath = (id) => join(videosDir, `${pad(id)}.json`);
const checked = (s) => s.status === 'released' && s.check?.by === 'fact-checker' && ['pass', 'fixed'].includes(s.check.verdict);

/** The story the Producer should film: yesterday's, if it was checked and has no script yet. */
function next(wanted) {
  const { stories } = loadStories();
  const today = londonNow().date;
  if (wanted) {
    const s = stories.find((x) => x.id === wanted);
    if (!s) return { nothing: `There is no story No. ${wanted}.` };
    if (!checked(s)) return { nothing: `No. ${wanted} hasn't been passed by the fact-checker (it is ${s.status}${s.check ? `, ${s.check.verdict} by the ${s.check.by}` : ''}). Videos are only made from checked stories.` };
    return { id: s.id, title: s.title, date: s.date, story: `content/issues/${pad(s.id)}.json`, script: `videos/${pad(s.id)}.json`, exists: existsSync(scriptPath(s.id)) };
  }
  // Readers have had a story for a day before its video is made.
  const eligible = stories.filter((s) => s.date < today && checked(s));
  const newest = eligible.at(-1);
  if (!newest) return { nothing: 'No checked story from before today.' };
  if (existsSync(scriptPath(newest.id))) return { nothing: `The newest checked story, No. ${newest.id}, already has a video script.` };
  const skipped = stories.filter((s) => s.date < today && s.id > newest.id).map((s) => `No. ${s.id} (${s.status === 'released' ? 'released unchecked' : s.status})`);
  return {
    id: newest.id, title: newest.title, date: newest.date,
    story: `content/issues/${pad(newest.id)}.json`, script: `videos/${pad(newest.id)}.json`,
    ...(skipped.length ? { note: `Skipped, because they weren't passed by the fact-checker: ${skipped.join(', ')}.` } : {}),
  };
}

/** Problems with one video script. An empty list means it is fine. */
export function problemsWith(file) {
  const problems = [];
  const bad = (msg) => problems.push(msg);
  const m = /(\d{4})\.json$/.exec(file);
  if (!m) return [`${file}: a video script is named after its story, e.g. videos/0009.json`];
  const id = Number(m[1]);
  let v;
  try {
    v = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    return [`invalid JSON (${e.message})`];
  }
  const isStr = (x) => typeof x === 'string' && x.trim().length > 0;
  if (v.issue !== id) bad(`"issue" is ${v.issue}, but the file is named for No. ${id}`);
  const story = loadStories().stories.find((s) => s.id === id);
  if (!story) bad(`there is no story No. ${id}`);
  else if (!checked(story)) bad(`No. ${id} hasn't been passed by the fact-checker, so it can't be filmed`);

  const lines = Array.isArray(v.lines) ? v.lines : [];
  if (lines.length < 5 || lines.length > 16) bad(`"lines" needs 5 to 16 lines (it has ${lines.length})`);
  lines.forEach((l, i) => {
    const n = `line ${i + 1}`;
    if (!isStr(l?.text)) return bad(`${n} needs "text"`);
    if (l.text.length > 260) bad(`${n} is ${l.text.length} characters; split it into two lines (260 at most)`);
    if (l.say !== undefined && !isStr(l.say)) bad(`${n}: "say" must be words for the voice, or left out`);
    if (l.art !== undefined && !art.pictures[l.art]) bad(`${n}: there is no picture called "${l.art}" (run: node scripts/video.mjs pictures)`);
    if (/https?:|www\.|#\w/.test(l.text)) bad(`${n}: no links or hashtags in the spoken script`);
  });
  if (lines.length) {
    const first = lines[0];
    if (isStr(first?.text) && first.text.split(/\s+/).length > 10) bad(`line 1 is the hook and must land in the first two seconds: 10 words at most (it has ${first.text.split(/\s+/).length})`);
    if (!first?.art) bad('line 1 needs "art": the picture the video opens on');
    const last = lines.at(-1);
    if (last?.text !== SIGN_OFF) bad(`the last line must be exactly: "${SIGN_OFF}"`);
    if (last?.say !== undefined) bad('the last line must not have "say"');
  }
  const used = lines.map((l) => l?.art).filter(Boolean);
  const pictures = new Set(used);
  if (pictures.size !== used.length) bad('the same picture is used twice; each picture appears once');
  if (pictures.size < 3) bad(`use at least 3 different pictures (it uses ${pictures.size})`);
  if (pictures.size > 8) bad(`use at most 8 pictures (it uses ${pictures.size}); each needs a few seconds on screen`);

  const spoken = lines.map((l) => (isStr(l?.text) ? l.text : ''));
  const words = spoken.join(' ').split(/\s+/).filter(Boolean).length;
  const seconds = spoken.join('').length / CHARS_PER_SECOND + PAUSES(lines.length);
  if (seconds > MAX_SECONDS) bad(`about ${Math.round(seconds)} seconds when spoken; the limit is ${MAX_SECONDS}. Cut about ${Math.ceil(((seconds - MAX_SECONDS + 2) * CHARS_PER_SECOND) / 5.5)} words`);
  if (seconds < 38) bad(`only about ${Math.round(seconds)} seconds when spoken; aim for 50 to 58`);

  if (!isStr(v.caption)) bad('"caption" is missing: the words Carl pastes under the post');
  else {
    if (v.caption.length < 60 || v.caption.length > 500) bad(`"caption" is ${v.caption.length} characters; keep it between 60 and 500`);
    if (/#\w/.test(v.caption)) bad('put hashtags in "hashtags", not in the caption');
    if (/https?:|www\./.test(v.caption)) bad('no links in the caption');
  }
  if (!Array.isArray(v.hashtags) || v.hashtags.length < 3 || v.hashtags.length > 8) bad('"hashtags" needs 3 to 8 hashtags');
  else {
    for (const h of v.hashtags) if (!/^#[A-Za-z0-9_]+$/.test(h ?? '')) bad(`"${h}" isn't a hashtag: a # then letters and numbers, no spaces`);
    if (new Set(v.hashtags.map((h) => String(h).toLowerCase())).size !== v.hashtags.length) bad('the same hashtag is listed twice');
  }
  return problems.length ? problems : { words, seconds: Math.round(seconds), pictures: [...pictures] };
}

const [command, ...rest] = process.argv.slice(2);
if (command === 'next') {
  const at = rest.indexOf('--story');
  console.log(JSON.stringify(next(at >= 0 ? Number(rest[at + 1]) : undefined), null, 2));
} else if (command === 'pictures') {
  for (const [name, p] of Object.entries(art.pictures)) console.log(`${name.padEnd(24)} ${p.shows}. Good for: ${p.goodFor}.`);
} else if (command === 'check') {
  const files = rest.length ? rest : existsSync(videosDir) ? readdirSync(videosDir).filter((f) => /^\d{4}\.json$/.test(f)).sort().map((f) => join(videosDir, f)) : [];
  let failed = 0;
  for (const f of files) {
    const r = problemsWith(f);
    if (Array.isArray(r)) {
      failed++;
      console.error(`✗ ${f}:\n  ` + r.join('\n  '));
    } else console.log(`✓ ${f}: ${r.words} words, about ${r.seconds} seconds, ${r.pictures.length} pictures`);
  }
  if (!files.length) console.log('No video scripts to check.');
  process.exit(failed ? 1 : 0);
} else if (command === 'wait') {
  // Watches the "Make the video" run that saving the script started, and says how it ended.
  const id = Number(rest[0]);
  if (!Number.isInteger(id) || id < 1) {
    console.error('Usage: node scripts/video.mjs wait N');
    process.exit(2);
  }
  const repo = process.env.GITHUB_REPOSITORY || 'TuckyPsyc/curiouser';
  const gh = (path) => {
    const r = spawnSync('gh', ['api', path], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return r.status === 0 ? r.stdout : null;
  };
  const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' }).stdout.trim();
  const sha = git('log', '-1', '--format=%H', '--', `videos/${pad(id)}.json`);
  if (!sha) {
    console.error(`videos/${pad(id)}.json hasn't been saved yet.`);
    process.exit(1);
  }
  const minutes = Number(process.env.VIDEO_WAIT_MINUTES || 9);
  const until = Date.now() + minutes * 60000;
  let run = null;
  while (Date.now() < until) {
    const runs = JSON.parse(gh(`repos/${repo}/actions/workflows/video.yml/runs?head_sha=${sha}&per_page=5`) || '{}').workflow_runs ?? [];
    run = runs[0] ?? null;
    if (run?.status === 'completed') break;
    await new Promise((r) => setTimeout(r, 20000));
  }
  if (!run) {
    console.log(`No render has started for videos/${pad(id)}.json (commit ${sha.slice(0, 7)}) after ${minutes} minutes. Say so in your report.`);
    process.exit(1);
  }
  if (run.status !== 'completed') {
    console.log(`The render is still running after ${minutes} minutes: ${run.html_url}\nRun this command again to keep waiting.`);
    process.exit(3);
  }
  if (run.conclusion === 'success') {
    const tag = `curiouser-${pad(id)}`;
    const release = JSON.parse(gh(`repos/${repo}/releases/tags/${run.head_branch === 'rehearsal' ? 'videos-rehearsal' : 'videos'}`) || '{}');
    const meta = (release.assets ?? []).find((a) => a.name === `${tag}.json`);
    let made = '';
    if (meta) {
      const r = spawnSync('gh', ['api', '-H', 'Accept: application/octet-stream', `repos/${repo}/releases/assets/${meta.id}`], { encoding: 'utf8' });
      if (r.status === 0) made = r.stdout.trim();
    }
    console.log(`✓ The video for No. ${id} was made: ${run.html_url}${made ? `\n${made}` : ''}`);
    process.exit(0);
  }
  // It failed. Show what the renderer said, so a too-long script can be trimmed and saved again.
  const jobs = JSON.parse(gh(`repos/${repo}/actions/runs/${run.id}/jobs`) || '{}').jobs ?? [];
  const log = jobs.length ? gh(`repos/${repo}/actions/jobs/${jobs[0].id}/logs`) || '' : '';
  const said = log.split('\n').map((l) => l.replace(/^\S+Z /, '')).filter((l) => /Too long|✗|##\[error\]|Error:|error:|must be|Traceback/.test(l)).slice(-12);
  console.log(`✗ The render for No. ${id} failed (${run.conclusion}): ${run.html_url}\n${said.join('\n') || '(no error line found in the log)'}`);
  process.exit(1);
} else if (import.meta.url === `file://${process.argv[1]}`) {
  console.error('Usage: node scripts/video.mjs next [--story N] | check [file…] | pictures | wait N');
  process.exit(2);
}
