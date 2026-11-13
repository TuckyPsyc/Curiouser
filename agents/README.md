# The team

Curiouser is run by a handful of scheduled agents, each with one narrow job, and Carl as editor-in-chief. Agents prepare; Carl publishes. This folder holds each agent's instructions. To change what an agent does, edit its file: its scheduled task only says "read your file and follow it".

| Agent | Job | When (UK time) | Instructions | May change |
|---|---|---|---|---|
| Editor | Writes the day's story as a draft | Daily, 04:47 | Its scheduled task, plus `CONTENT_GUIDE.md` | `content/issues/` |
| Fact-checker | Checks the draft independently, then releases or holds it | Daily, 05:40 | `agents/fact-checker.md` | `content/issues/`, `content/checks/` |
| Producer | Writes the script for a 60-second video of yesterday's checked story; GitHub renders it | Daily, 06:07 | `agents/producer.md` | `videos/NNNN.json` |
| Analyst | Reports honestly on what can be counted | Mondays, 06:23 | `agents/analyst.md` | `reports/` |
| Marketing | Studies what earns attention elsewhere, invents ideas, and sets the Producer's style through `marketing/playbook.md` | Sundays, 07:37 | `agents/marketing.md` | `marketing/` |
| Developer | Builds the top Ready item in `IDEAS.md` and opens a pull request | Saturdays, 07:10 | `agents/developer.md` | a `dev/…` branch only, never `main` |
| Support | Drafts replies to readers for Carl to send | Not scheduled until there is a mailbox | `agents/support.md` | `support/status.json` |

All of them run on `claude-opus-5-5`. Why these times: DECISIONS.md, D-016.

## The morning

1. **04:47** The Editor writes `content/issues/NNNN.json` and saves it. It is a draft: readers can't see it.
2. **05:40** The fact-checker re-researches every claim, opens every link, and writes its verdict to `content/checks/NNNN.json`. `pass` or `fixed` releases the story. `held` keeps it back, and the previous story stays in place.
3. **06:30** If the story still has no verdict, the desk raises a ticket and Carl's phone buzzes. Closing that ticket publishes the story unchecked. Nothing else can.
4. **06:07** The Producer writes the script for a video of yesterday's story, if the fact-checker passed it. GitHub renders the video and puts it on the desk within about five minutes.
5. **After 06:45** The desk sends its morning note, signed by Fenton, with everything waiting for Carl in one place.
6. **07:00** The app shows the newest released story.

## Carl's queue

Everything waiting on Carl is one ranked list at the top of the desk: requests from agents, release tickets, pull requests, a fresh video to post, support drafts, and a brief or report under two days old. Blocking things come first, then deadlines, then the quickest. Below it, each agent's health, judged by what it produced: ✓, ✗ or not due (DECISIONS.md, D-020).

- **Asking.** An agent that needs Carl runs `node scripts/ask-carl.mjs --from <agent> --title "…" --why "…" --minutes N --how "…"`, with `--blocks "…"` or `--by YYYY-MM-DD` if they're true. It opens an issue labelled `needs-carl`, never twice with the same title. The desk assigns Carl, which is what makes his phone buzz. `--rehearsal` prints the request and writes nothing.
- **Answering.** Carl comments on the request if there's anything to say, then closes it. Closing it as not planned means no. An agent reads the answers to its own requests with `node scripts/ask-carl.mjs --answers --from <agent>`; only Carl's own comments count. Marketing, the Analyst and Support do this at the start of each run.
- **The status page.** Each time the desk updates it also writes `status.md` and `status.json` to the `status` branch, at `raw.githubusercontent.com/TuckyPsyc/Curiouser/status/status.md`. Fenton, Carl's chief of staff in the Claude project HQ, reads it aloud. Pushes to that branch start no workflows.

## Rules every agent follows

- **Agents prepare, Carl publishes.** No agent posts to social media, sends an email or message, replies to a review, spends money, merges code into `main`, or changes a decision in `DECISIONS.md`. The one exception is the fact-checker releasing or holding stories.
- **Ask Carl through `scripts/ask-carl.mjs`**, not only in a report or brief, and never comment on a request yourself.
- **Save through `scripts/save.mjs`.** It commits only the files that agent is allowed to change (the last column above), and refuses anything else.
- **This repository is public.** No secrets, keys, email addresses or readers' details in it, ever (D-001).
- **Nothing that needs a reinstall** without Carl's approval: no changes to `package.json`, `app.json`, `app.config.js`, `eas.json` or `assets/` (D-008).
- **Tenniel only.** Pictures are John Tenniel's original engravings, never Disney's (D-009). Any AI voice is original, never a soundalike of a real person, and labelled as AI.

## Asking an agent for something

Open an issue labelled `for-<agent>` (`for-developer`, `for-marketing`, `for-producer`, `for-fact-checker`, `for-analyst` or `for-support`), or ask Fenton to. The agent reads it at the start of its next run with `scripts/requests.mjs`, does it if its rules allow, and answers on the issue. Its answer appears on Carl's queue; closing the issue says he has read it. Only Carl's own issues and comments count.

Weekly agents answer weekly. For an answer today, start the agent's scheduled task with the message "Requests only": it handles its requests and nothing else. That uses some of Carl's plan.

The Editor takes no requests: its instructions are its scheduled task's prompt, which is Carl's to change.

## Practising without readers noticing

Push to a branch called `rehearsal` and the desk and its tickets run there instead: everything is labelled "rehearsal", nobody is notified, and the status page goes to `status-rehearsal`. The app only ever reads `main`.
