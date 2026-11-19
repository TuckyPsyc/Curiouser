# Redesigning the videos (Marketing, 15 November 2026)

Carl asked for this: the scripts are solid but predictable. He is building two new voices. Each story gets the voice that suits it, chosen by the Producer, not a rota (Carl, 15 Nov: better an irregular order with the right voice than a fixed pattern with the wrong one). This says what changed, why, and what needs his yes or the Developer's hands.

## What changes, and the evidence

Grades: Shaky (seen once), Contested (counter-examples), Well supported (repeated across several sources).

1. **End when the curiosity ends.** We drop the "it matters because" line after the payoff. A creator cut one second from an ending and retention went from 83% to 88%. A large faceless channel ends the moment the question is answered. Jenny Hoyos, https://creatorscience.com/podcast/jenny-hoyos/ (around 2024); Zack D. Films breakdown, https://danielrusnok.substack.com/p/how-a-faceless-channel-engineered (25 Jul 2026). Well supported in principle, but the evidence is secondhand.
2. **Open on the result, hold back the cause, and make the cause the idea.** This replaces the chronological story with the idea named late. Hoyos, as above. A first story-driven Short got 30M views against about 3,000 for an earlier abstract one: https://rosetta.to/u/vidiq/how-genius-youtubers-get-1-000-000-000-views-from-shorts (Dec 2023, a first breakout). Shaky.
3. **A narrator with a character.** It is the opposite of the category's voice of nobody. A National Gallery of Art curator's register-clash reel got 2.1M views in three days: https://washingtonian.com/2026/01/16/the-national-gallery-of-arts-new-viral-star-is-a-curator-with-serious-gen-z-rizz/ (16 Jan 2026). In a study of 9,654 TikToks, a humorous tone went with more likes and original spoken audio with more shares: https://arxiv.org/html/2606.16053 (Jun 2026). Contested.
4. **Let the viewer guess wrong, then overturn it, and keep the key word for last.** This is stand-up misdirection: https://australia.toastmasters.org/magazine/magazine-issues/2026/june/the-elements-of-comedic-surprise (Jun 2026). Well supported as craft.
5. **The trailer's button.** One more true line after the payoff that recolours it, then stop: https://jonnyelwyn.co.uk/film-and-video-editing/how-to-edit-a-movie-trailer/. Well supported as craft.
6. **A fixed slot, rotating voices, a signature close.** Radio 4's *Tweet of the Day* is 90 seconds, with presenters who rotate, and has run since 2013. A.Word.A.Day closes every issue with "Thought for Today". This is where "Today's word" and "Today's number" come from. Well supported.
7. **Moderate pace is fine.** Engagement rose with cuts and loudness only up to a point, in 1,200 Reels and 10,000 science TikToks: https://arxiv.org/pdf/2604.19995 (Apr 2026). Slow engravings are not a handicap if something changes regularly. Shaky.
8. **Platform rules.**
   - Since 30 Apr 2026, Instagram stops recommending accounts that mainly post unoriginal reels; burned-in subtitles alone don't count as original: https://creators.instagram.com/blog/rewarding-original-creators-on-instagram. Our narration and checked story should count.
   - Upload a clean file to each platform, never one with the other platform's watermark.
   - TikTok forbids synthetic voices imitating real people, so the narrators must stay original: https://www.tiktok.com/community-guidelines/en/integrity-authenticity.

## Live now (the playbook)

`marketing/playbook.md` is rewritten. It has the two narrators, chosen by the Producer to suit each story, nine standing rules, and one experiment on the closing line: the **button** (odd numbers) against the **ritual** (even numbers: "Today's word" or "Today's number"). Both arms work under the current Producer file. The old hook experiment is closed with no numbers. Samples written to today's rules are in `marketing/drafts/samples/`; both pass `video.mjs check`.

## Needs Carl's yes, then the Developer

1. **Two voices, chosen per script.** `videos/voice.json` gains `"narrators": { "raconteur": {…}, "reckoner": {…} }`, each with the provider and voice settings used today. The renderer reads the script's `"narrator"` field (the Producer already writes it; the check accepts it today). `check` should require it and print it. If a narrator has no voice yet, use today's voice and say so on the desk. The voices themselves are Carl's to make.
2. **The sign-off becomes `Curiouser.`** The end card shows "Curiouser No. N · get curiouser before breakfast" with the White Rabbit for about 1.5 seconds, silent. This saves about three seconds of speech after the payoff. Change `SIGN_OFF` in `scripts/video.mjs` and the renderer's end card.
3. **Length 120 to 175 words.** The Producer file asks for 150 to 175 today; the check's own floor is about 38 seconds, which can stay. The finding: best performers often finish well under 60 seconds, and no platform says 60 is best. Contested. Note that TikTok's Creator Rewards needs videos "over a minute", but only from 10,000 followers.
4. **`"pause": true` on a line:** about 0.6 seconds of silence before it, at most once per script. In a trailer, the drop in sound before the reveal does this job.
5. **Install `marketing/drafts/producer.md` as `agents/producer.md`.** Its "unchanged" and "as now" sections keep the current file's text word for word.

## Not changed

Tenniel's engravings only, the fact-check rules, the AI-voice label, no music, no face, Carl publishes.
