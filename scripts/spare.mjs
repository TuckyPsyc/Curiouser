#!/usr/bin/env node
// The spare story: one checked story kept in reserve (DECISIONS.md, D-021).
//
//   node scripts/spare.mjs status
//       What the spare is and whether it is ready. Prints the sha256 the
//       fact-checker records in content/checks/spare.json.
//
//   node scripts/spare.mjs use [--note "why"]
//       Puts the checked spare out as today's story, but only when today has no
//       story readers can see and none waiting for the fact-checker: that is,
//       today's story is missing or was held. The spare becomes the next
//       numbered story, dated today, keeping its own topic; its verdict moves
//       with it. Then it rebuilds the feed. The caller saves: the fact-checker
//       with scripts/save.mjs, or release.yml when Carl closes a "missing" ticket.
//
// Exit codes: 0 done or nothing to do, 1 refused (the reason is printed).
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { issuesDir, checksDir, checkPath, sparePath, spareCheckPath, loadSpare, loadStories, londonNow, pad } from './lib/state.mjs';

const args = process.argv.slice(2);
const cmd = args[0];
const noteAt = args.indexOf('--note');
const note = noteAt >= 0 ? args[noteAt + 1] : '';
const WORDS = {
  none: 'There is no spare. The Editor writes one on its next run.',
  unchecked: 'The spare is waiting for the fact-checker.',
  changed: 'The spare has changed since it was checked, so it is waiting for the fact-checker again.',
  held: 'The fact-checker held the spare. The Editor replaces it on its next run.',
  checked: 'The spare is checked and ready.',
};

const s = loadSpare();

if (cmd === 'status') {
  console.log(WORDS[s.status]);
  if (s.spare) {
    console.log(`  "${s.spare.title}" (${s.spare.concept}), ${s.spare.topic}, written ${s.spare.written}`);
    console.log(`  sha256: ${s.sha}`);
  }
  if (s.check) console.log(`  last verdict: ${s.check.verdict} by the ${s.check.by} at ${s.check.at}${s.check.sha256 === s.sha ? '' : ' (for an earlier version)'}`);
  if (s.problem) console.log(`  problem: ${s.problem}`);
  process.exit(0);
}

if (cmd !== 'use') {
  console.error('Usage: node scripts/spare.mjs status | use [--note "why"]');
  process.exit(2);
}

const uk = londonNow(process.env.SPARE_NOW ? new Date(process.env.SPARE_NOW) : new Date());
const { stories } = loadStories();
const todays = stories.filter((x) => x.date === uk.date);
const refuse = (msg) => {
  console.log(`Spare not used: ${msg}`);
  process.exit(1);
};
if (todays.some((x) => x.status === 'released')) {
  console.log(`Spare not needed: today's story is already out (No. ${todays.find((x) => x.status === 'released').id}).`);
  process.exit(0);
}
if (todays.some((x) => x.status === 'draft')) refuse(`today's story (No. ${todays.find((x) => x.status === 'draft').id}) is still waiting for the fact-checker.`);
if (s.status !== 'checked') refuse(WORDS[s.status]);

const id = Math.max(0, ...stories.map((x) => x.id)) + 1;
const why = todays.length ? `today's story (No. ${todays.at(-1).id}) was held` : "today's story was missing";
const { written, ...rest } = s.spare;
const issue = { id, date: uk.date, topic: rest.topic, ...rest, spare: true };
const check = {
  ...s.check,
  issue: id,
  summary: `${s.check.summary} (Checked as the spare on ${s.check.at.slice(0, 10)}; written ${written}; used on ${uk.date} because ${why}.)`,
  ...(note ? { note } : {}),
  fromSpare: { written, checked: s.check.at, used: uk.date, why },
};
delete check.sha256;
mkdirSync(checksDir, { recursive: true });
writeFileSync(join(issuesDir, `${pad(id)}.json`), JSON.stringify(issue, null, 2) + '\n');
writeFileSync(checkPath(id), JSON.stringify(check, null, 2) + '\n');
rmSync(sparePath);
rmSync(spareCheckPath, { force: true });

const build = spawnSync(process.execPath, [fileURLToPath(new URL('./build-feed.mjs', import.meta.url))], { stdio: 'inherit', env: process.env });
if (build.status !== 0) {
  console.error('The spare failed validation as a numbered story (see above). Undo with: git checkout -- content && git clean -fd content');
  process.exit(1);
}
console.log(`Used the spare as No. ${id} "${issue.title}" for ${uk.date}, because ${why}.`);
if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `id=${id}\ntitle=${issue.title.replace(/\n/g, ' ')}\n`, { flag: 'a' });
}
