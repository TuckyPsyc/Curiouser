# The team

Curiouser is run by a handful of scheduled agents, each with one narrow job, and Carl as editor-in-chief. Agents prepare; Carl publishes. This folder holds each agent's instructions. To change what an agent does, edit its file: its scheduled task only says "read your file and follow it".

| Agent | Job | When (UK time) | Instructions | May change |
|---|---|---|---|---|
| Editor | Writes the day's story as a draft | Daily, 04:47 | Its scheduled task, plus `CONTENT_GUIDE.md` | `content/issues/` |
| Fact-checker | Checks the draft independently, then releases or holds it | Daily, 05:40 | `agents/fact-checker.md` | `content/issues/`, `content/checks/` |

## The morning

1. **04:47** The Editor writes `content/issues/NNNN.json` and saves it. It is a draft: readers can't see it.
2. **05:40** The fact-checker re-researches every claim, opens every link, and writes its verdict to `content/checks/NNNN.json`. `pass` or `fixed` releases the story. `held` keeps it back, and the previous story stays in place.
3. **06:30** If the story still has no verdict, the desk raises a ticket and Carl's phone buzzes. Closing that ticket publishes the story unchecked. Nothing else can.
4. **After 06:45** The desk sends its morning note, with everything waiting for Carl in one place.
5. **07:00** The app shows the newest released story.

## Rules every agent follows

- **Agents prepare, Carl publishes.** No agent posts to social media, sends an email or message, replies to a review, spends money, merges code into `main`, or changes a decision in `DECISIONS.md`. The one exception is the fact-checker releasing or holding stories.
- **Save through `scripts/save.mjs`.** It commits only the files that agent is allowed to change (the last column above), and refuses anything else.
- **This repository is public.** No secrets, keys, email addresses or readers' details in it, ever (D-001).
- **Nothing that needs a reinstall** without Carl's approval: no changes to `package.json`, `app.json`, `app.config.js`, `eas.json` or `assets/` (D-008).
- **Tenniel only.** Pictures are John Tenniel's original engravings, never Disney's (D-009). Any AI voice is original, never a soundalike of a real person, and labelled as AI.

## Practising without readers noticing

Push to a branch called `rehearsal` and the desk and its tickets run there instead: everything is labelled "rehearsal" and nobody is notified. The app only ever reads `main`.
