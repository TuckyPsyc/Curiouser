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
| `lookingGlass` | Through the Looking-Glass: the other side of the idea | 80–160 words |
| `quiz` | Questions for Sunday's Caucus-race | 2 questions |
| `sources` | Where every claim came from | at least 3 |

## Voice

- **Start in a scene:** a person, a place, a year, a problem. Don't start with the concept.
- **Reveal the idea** around paragraph three or four, by name, in plain words.
- **End with why it matters now.** Keep it to one or two sentences, and don't preach.
- **Write in British English.** Short sentences, concrete detail, no exclamation marks.
- **No invented dialogue or detail.** Quote only words you have found in a source. Say "reportedly" or "the story goes" when a source does, and prefer telling the debunked version of a famous myth over repeating it.

## Topics

Curiouser is deliberately broad. The point is to take readers outside their own bubble, not to feed it (see DECISIONS.md, D-007). There are fifteen topics, and from issue 6 they rotate in this order, repeating every 15 issues. The topic for issue `id` is position `(id - 6) % 15`:

| # | Topic | Covers |
|---|---|---|
| 0 | Science | Physics, chemistry, biology, astronomy, and how discoveries were actually made |
| 1 | History | Events, people and turning points from any era and any part of the world, not just Europe |
| 2 | Philosophy | Arguments, thought experiments and ethics, from every tradition |
| 3 | Psychology | Mind, behaviour, development and social psychology |
| 4 | Nature | Animals, plants, ecology, geology, oceans and weather |
| 5 | Literature | Books, poetry, drama and storytelling, from any language or tradition |
| 6 | Economics | Money, markets, trade, incentives, and how economies work and fail |
| 7 | Self-Improvement | Habits, learning, character and wellbeing, backed by evidence |
| 8 | Art & Music | Painting, sculpture, architecture, design, music and film |
| 9 | Mathematics | Numbers, probability, statistics, logic, and the people behind them |
| 10 | Gentleman's Pursuits | The crafts and pleasures of a well-lived life: tailoring, shaving, whisky and wine, watches, pens and letters, fishing and the outdoors, woodcraft, cookery, etiquette, games and sport. Never glamorise heavy drinking or smoking |
| 11 | Society | Law, politics, religion, anthropology and how communities organise. Describe positions even-handedly; never take sides on contested questions |
| 12 | Technology | Inventions, engineering, computing, and their consequences |
| 13 | Language | Words, etymology, grammar, rhetoric, and how languages change |
| 14 | Health & Medicine | The body, medicine, public health and medical discoveries |

Issues 1–5 were the launch set (History, Psychology, Literature, Self-Improvement, Gentleman's Pursuits) and sit outside the rotation. `scripts/build-feed.mjs` checks the topic.

**Range within every topic.** Move across centuries, continents and cultures. Over a cycle, no more than about half the stories should come from Britain, Europe or North America. Include people and ideas the reader may disagree with, presented fairly.

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

## Through the Looking-Glass

Every issue has one. It gives the other side of the day's idea, and it must never invent a controversy. Choose the `kind` honestly:

- **`counter`**: there's a real objection, limit or competing finding. Give its strongest version, with evidence, then say where it leaves the idea.
- **`none`**: there's no serious case against the idea. Say so plainly, explain briefly why it's well established, and, if useful, warn against stretching it too far.
- **`myth`**: there's a popular "counter" that doesn't hold up, such as a widely repeated debunking that is itself wrong. Debunk it with evidence.

Other fields:

- **`heading`**: a short headline for the other side.
- **`body`**: 1–2 paragraphs, 80–160 words.
- **`confidence`**: how well supported the day's idea is, after weighing the other side. It is one of `Shaky`, `Contested`, `Well supported` or `Settled`. Be conservative: `Settled` is for findings virtually no expert disputes.
- **`verdict`**: one sentence starting from "where that leaves you", giving practical, even-handed advice.

The Looking-Glass's sources go in the issue's `sources` list like everything else. Don't repeat material already used in the rabbit hole.

## The Caucus-race questions

Every Sunday the app runs the Caucus-race, a five-question quiz on the week's stories, drawn from each issue's `quiz`. Write two questions per issue:

- **One on the story** (what happened, who found what) and **one on the idea** (what the concept means, or which example fits it). Recall of the idea matters more than trivia.
- **Answerable from the story alone.** Don't ask about the rabbit hole or the Looking-Glass.
- **`options`**: 3 or 4, with the right one at `answer` (counting from 0). Put it first if you like; the app shuffles them. Wrong options should be plausible, clearly wrong to someone who read the story, and never partly true. Never write "all of the above" or similar.
- **`explain`**: one or two sentences, under 45 words, saying why the answer is right, with a detail from the story.

```json
"quiz": [
  {
    "question": "Why did Hanoi's rat bounty make the problem worse?",
    "options": ["Hunters cut off the tails and let the rats go to breed", "The rats grew resistant to poison", "The rat-catchers went on strike"],
    "answer": 0,
    "explain": "A tail was good proof of a dead rat only until tails were worth money."
  }
]
```

## Accuracy

1. Research before writing. Find at least three independent sources, preferring scholarly, primary or official ones. Wikipedia is fine for orientation, but check contested claims elsewhere.
2. Every name, date, number and quotation in the story and rabbit hole must be traceable to a listed source.
3. Before committing, reread the draft against the sources line by line. Cut anything you can't support.
4. Don't quote more than about 40 words from any copyrighted work. Public-domain texts are fine.
5. On contested political topics, describe the positions; don't take sides.
6. Never repeat a concept. `scripts/build-feed.mjs` rejects duplicates. Also avoid reusing the same person or event within the last 30 issues.

## Publishing

A story goes through two pairs of hands before readers see it (DECISIONS.md, D-012).

1. **The Editor writes a draft.** Write `content/issues/NNNN.json` (four digits, the next number after the highest in `content/issues/`) with `date` set to today's UK date. Copy the structure of an existing issue. Straight quotes are fine; they're curled automatically.
2. Run `node scripts/build-feed.mjs` and fix anything it reports. It will list the new story as "waiting for the fact-checker". That is expected: a story with no verdict is a draft, and readers can't see it.
3. Save with `node scripts/save.mjs --agent editor -m "Before Breakfast No. N: Title"`. It commits the story and pushes it to `main`. Story-only changes don't rebuild the app.
4. **The fact-checker releases it.** A separate agent checks the draft independently at 05:40 and writes its verdict to `content/checks/NNNN.json` (see `agents/fact-checker.md`). `pass` or `fixed` releases the story; `held` keeps it back. Whoever writes a story never writes its verdict.

Ask recall questions only about stories readers have seen, which are the ones listed in `content/feed.json`.

## Corrections

Edit the issue's JSON, run the build script, and commit with `Correction to No. N: what changed`. Readers get the fix next time they open the story. To have a published story checked again from scratch, start the fact-checker with the message "Re-check No. N".
