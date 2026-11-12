# Decisions log

Choices made for the proof of concept (a gift for a few friends), and what to revisit before Curiouser grows beyond that. Entries marked **Known weak point** are deliberate shortcuts, not oversights.

## D-001 · Public repository · Known weak point
**Decided:** 8 November 2026, by Carl.
**What:** This repository is public. The app fetches stories from it at runtime (`raw.githubusercontent.com`), and friends download the APK from its Releases page.
**Why:** Free hosting, free automatic builds and one download link, with no server to run.
**Risk:** Anyone can read the code, stories, build logs and commit history. Anything committed here, including by mistake, is public and stays in history. GitHub can see the IP addresses of phones fetching stories.
**Rules while public:** No secrets, API keys, personal data or friends' details in the repo, ever.
**Before expanding:** Move stories to a proper content host (for example a small API or a private bucket behind a CDN), make the repository private, and add a privacy notice.

## D-002 · APK signed with the shared React Native debug key · Known weak point
**Decided:** 8 November 2026.
**What:** Builds are signed with the standard debug keystore that ships with the React Native template, so every build has the same signature and installs over the previous one.
**Risk:** That key is public. Anyone could sign an app that Android would treat as an update to Curiouser. It also can't be used for Google Play.
**Before expanding:** Generate a private upload key, store it as a GitHub Actions secret, and use Play App Signing. Changing key means friends must uninstall and reinstall once.

## D-003 · Installed directly from GitHub, not Google Play
**Decided:** 8 November 2026.
**What:** Friends install the APK from the Releases page and must allow their browser to install unknown apps.
**Risk:** Google plans to require developer verification even for apps installed outside Play, expanding globally in 2027. A free limited-distribution option (up to 20 devices) has been announced for hobbyists.
**Before expanding:** Register a Play developer account ($25 one-off). New personal accounts must run a closed test with at least 12 testers for 14 consecutive days before going public.

## D-004 · Stories written by Claude on a daily schedule
**Decided:** 8 November 2026.
**What:** A scheduled task researches and writes one story each morning, following `CONTENT_GUIDE.md`, checks every claim against sources and lists them, then commits it here.
**Risk:** Errors can still get through. Corrections are made by editing the story's JSON file; the app picks up the fix automatically.

## D-005 · No accounts, analytics or personal data
**Decided:** 8 November 2026.
**What:** The app has no sign-in and no tracking. The 7am reminder is scheduled on the phone itself; nothing is sent to a server except requests for the public story files.

## D-007 · Broad topics, on purpose
**Decided:** 8 November 2026, by Carl.
**What:** Curiouser covers fifteen topics, from science and philosophy to art, money, language and medicine, rather than only the subjects Carl already likes. Within each topic, stories range across eras, cultures and viewpoints, and every story has a Looking-Glass panel giving the other side (or saying honestly that there isn't one).
**Why:** A learning app that only serves its readers' existing interests becomes a bubble. The aim is to widen what readers know, not to confirm it.

## D-008 · Over-the-air updates through Expo
**Decided:** 9 November 2026, by Carl.
**What:** Installed apps check Expo's update service each time they open, and pick up changes to screens, wording, styling and features without a reinstall. `.github/workflows/update.yml` publishes an update whenever `src/` changes; a new APK is built only for native-level changes.
**Rule:** `runtimeVersion` in app.json is fixed by hand. Bump it whenever a change needs native code (a new native library, new permissions, an Expo SDK upgrade), and build a new APK. Otherwise older installs could receive JavaScript they can't run and crash.
**Dependency:** Relies on Carl's free Expo account (free up to 1,000 monthly users) and the `EXPO_TOKEN` secret in GitHub. If Expo goes away, the app keeps working on its last update.

## D-009 · Tenniel's illustrations and the Carroll theme
**Decided:** 9 November 2026, by Carl.
**What:** The app uses John Tenniel's original engravings from both Alice books (public domain; Tenniel died in 1914), taken from Standard Ebooks' scans and converted to tintable line art in `src/art/`. Screens and features use Carroll's names with plain subtitles, so new readers aren't lost. No. 0, "Start here", tells the story of how *Alice* was written and doubles as the tutorial.
**Rule:** Never use Disney's 1951 designs or any later copyrighted adaptation.

## D-006 · Web version for iPhone friends
**Decided:** 8 November 2026, as a backup.
**What:** The same app builds for the web (`.github/workflows/web.yml`) and can be published to GitHub Pages, where it can be added to an iPhone home screen. It has no 7am reminder.
**Status:** Waiting for Pages to be switched on (Settings → Pages → Source: GitHub Actions).

## D-010 · A look of our own: "The Page"
**Decided:** 10 November 2026, by Carl.
**What:** White paper, black ink and Red Queen red, set in IM Fell English (the 17th-century Fell types of Oxford, digitised by Igino Marini, SIL Open Font Licence) with Literata for reading. A chessboard strip under the masthead nods to the chess game in *Through the Looking-Glass*. Follows the phone's dark mode; the rabbit hole stays night-blue in both.
**Why:** The first design (cream paper, brown ink, Fraunces with gold italics, widely spaced capitals) closely matched Honeyletter, another AI-built app. It is the default look such tools produce, so Curiouser needed a look that is clearly its own.
**Rule:** Avoid cream-and-brown palettes, Fraunces and gold italic accents. The old look and an always-dark "Night" alternative remain in `src/lib/theme.ts`, selectable with `EXPO_PUBLIC_DIRECTION`.

## D-011 · Streaks, Jars and quiz results stay on the phone
**Decided:** 10 November 2026, by Carl.
**What:** The Hatter's watch (streak and weekly Hatter's Hour), Jars and the Caucus-race all run on the phone alone, stored in the app's local storage. There are no accounts and nothing is sent anywhere, consistent with D-005. Every reader gets the same five Caucus-race questions each week, picked with the race's Sunday as the seed, so friends can compare answers in conversation.
**Consequence:** Deleting the app or clearing its data loses streaks, jars and comfits, and they don't move to a new phone.
**To revisit:** A friends leaderboard, the Looking-Glass vote, Un-birthday presents and subscriptions all need accounts and a server. That means changing D-005, and moving stories out of the public repo (D-001) before anything is paid.

## D-012 · Stories are drafts until the fact-checker releases them
**Decided:** 11 November 2026, by Carl.
**What:** The Editor saves each morning's story as a draft. A second scheduled agent, the fact-checker, checks it independently at 05:40 and writes a verdict to `content/checks/NNNN.json` (`agents/fact-checker.md`). `scripts/build-feed.mjs` puts a story into `content/feed.json`, `content/published/` and the app's bundled copy only when its verdict is `pass`, `fixed` or `released-unchecked`. A story with no verdict is a draft and one with the verdict `held` is kept back; neither appears anywhere the app looks, so apps already installed never see them.
**Why:** It is what backs up "curated and checked". One agent writing and checking its own work is not a check.
**Rule:** Whoever writes a story never writes its verdict. `scripts/save.mjs` enforces it: the Editor can save only to `content/issues/`. An unchecked story never releases itself. Only Carl can publish one, by closing its release ticket or running "Release a story" (`.github/workflows/release.yml`), and it is then recorded as `released-unchecked` by the editor-in-chief. `scripts/test-gate.mjs` tests all of this on every change.
**Consequence:** On a morning when the story is held or unchecked, readers see the previous story, and the 7:00 reminder, which is scheduled on the phone and can't know, still says a new one is waiting.
**Limits:** A story already bundled into an app update can't be taken back by holding it, only corrected. GitHub starts scheduled workflows late at busy times, so the 06:30 alarm for an unchecked story can arrive up to about 20 minutes late; four slots guard against a missed one.

## D-013 · The editor's desk is a pinned GitHub issue
**Decided:** 11 November 2026, by Claude under Carl's brief ("pick the simplest thing that works well on Android").
**What:** One issue, "The editor's desk", pinned to the top of this repository's Issues page. `scripts/desk.mjs` rewrites it whenever something changes: today's story and its verdict, the video to post with its caption, drafted support replies, open pull requests, the weekly report, and any automation that failed. A story that is unchecked, held or missing gets its own ticket, assigned to Carl so the GitHub app notifies him. Closing an "unchecked" ticket as completed is his one-tap release (D-012). One comment a day, after 06:45, is the morning note.
**Why:** Carl already has GitHub on his phone, it costs nothing, and it needs no new account, app or server.
**Limit:** Notifications depend on the GitHub app being installed with notifications on. GitHub starts scheduled workflows late at busy times, so the 06:30 alarm can be up to about 20 minutes late.

## D-014 · Videos: the Producer writes, GitHub renders, Carl posts
**Decided:** 11 November 2026, by Claude under Carl's brief.
**What:** Each morning at 06:07 the Producer agent writes a script for the previous day's story, but only if the fact-checker passed it (`agents/producer.md`, `videos/NNNN.json`). Saving the script starts `.github/workflows/video.yml`, which renders a 1080×1920 video of up to 60 seconds (`scripts/video/render.py`): narration, captions burned in, and Tenniel's engravings moving gently. The MP4, a captions file and the post caption are attached to a pre-release called "Videos", and the desk links to them. The ten newest are kept.
**Pictures:** Only Tenniel's engravings (D-009), downloaded from Standard Ebooks' repositories at the commits pinned in `scripts/video/art.json`. Standard Ebooks dedicates its own work on them to the public domain (CC0).
**Rule:** Nothing is ever posted for Carl. No music, because no track's licence has been checked.
**Why daily:** The Producer's run is short and the rendering is free on GitHub, so a daily video costs little of Carl's plan. Three a week would save almost nothing.

## D-015 · The narrator: a free AI voice now, swappable later
**Decided:** 11 November 2026, by Claude under Carl's brief. Carl has not yet chosen a permanent voice.
**What:** Videos are narrated by **Kokoro v1.0**, voice `bf_emma` (British English), run on GitHub with `kokoro-onnx`. Every video shows "Narrated by an AI voice" on screen, and the post caption says so too.
**Licence, checked 11 November 2026:** The model's page (huggingface.co/hexgrad/Kokoro-82M) declares `license: apache-2.0` and says "With Apache-licensed weights, Kokoro can be deployed anywhere from production environments to personal projects." Apache-2.0 allows commercial use. The tools used to run it are `kokoro-onnx` (MIT) and eSpeak NG (GPL-3.0, used only as a tool; it places no condition on the audio produced).
**Is it original?** The model card says it was trained only on public-domain audio, permissively licensed audio and synthetic audio from large providers' speech systems, with no "custom voice clones". No Kokoro voice is presented as a real person. The card does not say exactly what each voice was made from, so this is "not a soundalike of anyone, as far as is documented", not a guarantee. `bm_fable` and the other voices that share a name with another company's product are not used. Piper's British voices were rejected because each is trained on one real speaker's recordings.
**To change the voice:** edit `videos/voice.json`. `"voice": "bm_george"` is the male alternative; `"provider": "none"` makes captions-only videos. Saving the file remakes the newest video.
**ElevenLabs:** If a repository secret called `ELEVENLABS_API_KEY` exists, videos use Carl's ElevenLabs voice instead: the voice in the `ELEVENLABS_VOICE_ID` secret if set, otherwise the newest voice in his account made with Voice Design. If ElevenLabs fails, the free voice is used and the desk says so; if that fails too, the video is made with captions only. **Not tested against the real service**, which needs Carl's key; tested against a stand-in (`scripts/video/selftest.py`).
**Rule:** Never a soundalike of a real person, and always labelled as AI.

## D-016 · When the agents run, and on what
**Decided:** 11 November 2026, by Claude under Carl's brief.
**What:** Every scheduled agent runs on `claude-opus-5-5`, never Fable (Carl's rule). Each task's prompt only points at its file in `agents/`, so a job is changed by editing one file. The times (UK): Editor 04:47, Fact-checker 05:40, Producer 06:07, Analyst Mondays 06:23, Developer Saturdays 07:10. Support has no schedule until it has a mailbox.
**Why these times:** Claude plans allow a fixed amount of use in each five-hour window. On 11 November that limit stopped the fact-checker's re-checks mid-evening. So the work readers depend on (the story, then its check) comes first in a fresh early-morning window, and everything else follows it in the same window, where running out harms nothing that matters.
**Consequence:** Heavy use of Claude between about midnight and 05:00 can leave too little for the 04:47 and 05:40 runs. If that happens the story stays a draft and the desk raises a ticket (D-012).
**Also:** A run cut short by the limit is still recorded as "succeeded" in the task list. The Analyst therefore judges each agent by what it produced, not by that list.

## D-017 · Support drafts, and never sends
**Decided:** 11 November 2026, by Claude under Carl's brief.
**What:** The Support agent reads a mailbox used only for Curiouser and writes each reply as a draft in that mailbox for Carl to edit and send (`agents/support.md`, `support/TONE.md`, `support/FAQ.md`). Readers' names, addresses and words never enter this public repository; only a count of waiting drafts does. Anything about a reader's data, money, the press, legal threats or someone's safety gets no draft and goes straight to Carl.
**Status:** Built and rehearsed on invented messages. Switched off until Carl creates the mailbox and connects it.

## D-018 · The weekly report counts only what can be counted
**Decided:** 11 November 2026, by Claude under Carl's brief.
**What:** Each Monday the Analyst reports stories written, released and held, fact-check verdicts and corrections, APK downloads, pull requests, mornings that needed Carl, and failed automation (`agents/analyst.md`, `scripts/stats.mjs`, `reports/`). It reports reading, feature use and reader numbers as unknown, because the app sends nothing (D-005, D-011). Repository traffic is visible only to Carl, so it is not in the report.
**Rule:** No agent adds analytics. `reports/usage-counts-proposal.md` sets out what privacy-respecting counting could look like and what UK GDPR and PECR would require. The decision is Carl's.

## D-019 · A Marketing agent sets the videos' style
**Decided:** 12 November 2026, by Carl. Its instructions and starting playbook were designed by Claude Fable 5.2; the agent runs on `claude-opus-5-5` like the rest (D-016).
**What:** Every Sunday at 07:37 the Marketing agent studies what earns attention for comparable apps, educational creators and one unrelated field, invents and ranks ideas, and writes a one-screen brief for Carl (`agents/marketing.md`, `marketing/`). It keeps `marketing/playbook.md`, which the Producer follows on style: the hook's form, structure, tone, pictures, caption and hashtags. The playbook can never override the Producer's accuracy or safety rules or its fixed limits, and runs one experiment at a time.
**Measuring:** Carl reports each post's numbers by commenting on issue #8, "How the posts did". Only his own comments count. That and public pages are all the agent can see; it never adds tracking (D-005).
**Rule:** It prepares; Carl publishes. It never posts, comments, follows, messages, signs up or spends, and every idea states how many of Carl's minutes it needs.

## D-020 · One queue for Carl, a status page, and Fenton
**Decided:** 12 November 2026, by Claude under Carl's brief.
**What:** Everything waiting on Carl is one ranked list. Agents put requests on it with `scripts/ask-carl.mjs`, which opens an issue labelled `needs-carl`, never twice with the same title. The queue also holds open release tickets, open pull requests, the newest video while under two days old, support drafts waiting, and a Marketing brief or weekly report under two days old. Anything blocking an agent or readers comes first, then deadlines, then the quickest. Marketing, the Analyst and Support raise their requests this way and read Carl's answers (his own comments only) on their next run. The desk now opens with the queue, each item with its minutes and the one step to take on a phone, then each agent's health, judged by what it produced rather than by the task list: ✓, ✗ or not due.
**The status page:** each desk run writes `status.md` (under 200 words, written to be read aloud) and `status.json`, and force-pushes them to the `status` branch as a single commit, so they live at `raw.githubusercontent.com/TuckyPsyc/Curiouser/status/status.md` without commits on main. Pushes there start no workflows: a push made with a workflow's token never does, every workflow that runs on a push names its branches, and the commit says `[skip ci]`. `scripts/test-gate.mjs` checks the last two. A plain script, no AI, nothing to pay. A line in Fenton's voice, one of twenty chosen by how things stand, heads the page and signs the morning note. For this, `desk.yml` now has permission to write to the repository; the desk still never changes a file on main.
**Fenton:** a Claude project called HQ, set up by Carl, whose instructions make Claude a dry butler who reads this page aloud, records Carl's decisions and does nothing else. His instructions are kept in Carl's Claude project, not here. He is not a scheduled task and costs nothing when unused.
**Why the desk assigns Carl, not ask-carl:** the agents act as Carl's own GitHub account, and GitHub never notifies anyone of their own actions. The desk runs as github-actions about a minute after a request opens, and its assignment is what notifies him.
**Rules:** requests carry no personal details, and `ask-carl.mjs` refuses any containing an email address. Only issues opened by the owner, collaborators or bots reach the queue, and pull requests from outside the team appear without their titles, because Fenton reads the page aloud. Nothing about Carl's other projects goes on GitHub. Fenton never closes a release ticket (that publishes a story), merges, or changes an agent or a schedule.
**Limits:** raw.githubusercontent.com caches files for about five minutes, so the page can lag the desk slightly. If the desk stops running, the page goes stale; Fenton refuses to report from a page more than 26 hours old.
