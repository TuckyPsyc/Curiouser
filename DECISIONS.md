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
