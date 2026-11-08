# Writing a Curiouser story

Each morning's story ("Before Breakfast") teaches one named idea through a true story. This guide is for whoever writes the next one, including the scheduled task.

## The shape of an issue

| Part | What it is | Length |
|---|---|---|
| `title` | The story's headline, not the concept's name | 3–7 words |
| `concept` | The named idea it teaches, e.g. "Goodhart's law" | a few words |
| `teaser` | One line for the archive | ≤ 25 words |
| `story` | 4–6 paragraphs | 300–550 words |
| `takeaway` | The idea in a sip: what Drink Me shows | 1–2 sentences |
| `recall` | A question about an earlier issue, asked before reading | see below |
| `rabbitHole` | The Eat Me deep dive: title, intro, 3–5 levels, further reading | 120–200 words per level |
| `sources` | Where every claim came from | at least 3 |

## Voice

- **Start in a scene:** a person, a place, a year, a problem. Don't start with the concept.
- **Reveal the idea** around paragraph three or four, by name, in plain words.
- **End with why it matters now.** Keep it to one or two sentences, and don't preach.
- **Write in British English.** Short sentences, concrete detail, no exclamation marks.
- **No invented dialogue or detail.** Quote only words you have found in a source. Say "reportedly" or "the story goes" when a source does, and prefer telling the debunked version of a famous myth over repeating it.

## Topic rotation

Topics follow the issue number: `(id - 1) % 5` picks from

0. History
1. Psychology
2. Literature
3. Self-Improvement
4. Gentleman's Pursuits

**Gentleman's Pursuits** covers the crafts and pleasures of a well-lived life: tailoring and dress, shaving, whisky, wine and beer, watches, pens and letters, fly fishing and the outdoors, woodcraft, cookery, etiquette, games such as chess and cards, and sport. Avoid anything that glamorises heavy drinking or smoking.

## The recall question

- Ask about an issue roughly **3 to 10 issues earlier**. Spacing the reminder out helps memory more than asking about yesterday. Use the most recent issue only when fewer than three exist.
- Ask something answerable in a sentence, and make the answer name the concept.
- `fromIssue` must be that issue's `id`.

## The rabbit hole

Each level goes deeper or sideways, not just longer. A good pattern is:

1. the popular version and what the evidence actually says
2. the research or theory behind it
3. a surprising modern case

The `title` is its own headline. The `intro` is one or two sentences inviting the reader down. `furtherReading` lists 2–4 real books or papers with author and year; add a `url` only if you have checked it works.

## Accuracy

1. Research before writing. Find at least three independent sources, preferring scholarly, primary or official ones. Wikipedia is fine for orientation, but check contested claims elsewhere.
2. Every name, date, number and quotation in the story and rabbit hole must be traceable to a listed source.
3. Before committing, reread the draft against the sources line by line. Cut anything you can't support.
4. Don't quote more than about 40 words from any copyrighted work. Public-domain texts are fine.
5. On contested political topics, describe the positions; don't take sides.
6. Never repeat a concept. `scripts/build-feed.mjs` rejects duplicates. Also avoid reusing the same person or event within the last 30 issues.

## Publishing

1. Write `content/issues/NNNN.json` (four digits, next number in sequence) with `date` set to today's UK date. Copy the structure of an existing issue. Straight quotes are fine; they're curled automatically.
2. Run `node scripts/build-feed.mjs` and fix anything it reports.
3. Commit with the message `Before Breakfast No. N: Title` and push to `main`. Story-only changes don't rebuild the app; it fetches new stories itself.

## Corrections

Edit the issue's JSON, run the build script, and commit with `Correction to No. N: what changed`. Readers get the fix next time they open the story.
