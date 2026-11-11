# Proposal: counting use without watching readers

**For Carl to decide. Nothing here is built.** Written 11 November 2026. It would change D-005 and D-011, so nobody touches it without your yes. I'm not a lawyer: the legal points come from the ICO's guidance and should be checked there before you rely on them.

## The gap

The weekly report can count stories, checks, APK downloads and pull requests. It can't say whether anyone reads, which features get used, or whether readers come back, because the app sends nothing. That was right for a gift to friends. It becomes a handicap once you charge for Curiouser or advertise it.

## Three options

**1. Ask, don't collect. Recommended now.** A "Tell the editor how it's going" button writes a message from numbers already on the reader's phone (days read, jars, races run) and opens their own email or WhatsApp to send it, if they choose. The app sends nothing itself, there is no server, D-005 stands, and it reaches phones over the air. Its weakness: only keen readers reply.

**2. An anonymous daily tally. Recommended before you grow.** Once a day the app sends one small message: the date, the app version, and yes or no for opened, finished the story (and which number), Drink Me, the rabbit hole, the Looking-Glass and the Caucus-race. No account, no device identifier, no location, nothing typed. A small server adds it to that day's totals and discards it without logging where it came from. You would learn "14 phones opened it, 9 finished No. 12" and nothing about any one person. It needs a server (a free tier would do) but no reinstall.

**3. An off-the-shelf analytics kit. Not recommended.** These identify devices, usually send data to the United States, need a reinstall, and break the promise in spirit.

## What the law requires for option 2

- **PECR, regulation 6.** Reading information stored on a phone normally needs consent, in apps as on websites. The Data (Use and Access) Act 2025 added an exception for **statistical purposes**, explained in the ICO's guidance on storage and access technologies (final, 29 April 2026). It applies only if: the sole purpose is statistics on how the service is used, to improve it; readers get clear information about it; they have a simple, free way to object, such as a switch that is on by default; nothing is shared except with a company acting only on your instructions, or linked with other information; and the results are aggregate and identify nobody. Option 2 is designed to fit. If a condition slipped, you would need consent first.
- **UK GDPR.** The counts aren't personal data, but the internet address arriving with each message is. So: don't store it, note why you rely on legitimate interests, publish a short privacy notice (what is sent, why, who hosts it, how to switch it off or complain), and have the host's data processing terms in place.
- **The ICO fee.** Processing personal data beyond personal or household use can mean registering with the ICO and paying an annual fee (£52 at the lowest tier when this was written). Its online self-assessment settles it.
- **A privacy notice is due anyway.** GitHub and Expo already see a phone's internet address when the app fetches stories and updates (D-001, D-008). Say so before Curiouser goes beyond friends.

**Never collected, under any option:** names, emails, device or advertising identifiers, location, the time someone reads, anything typed, or anything linking one day's message to the next.

## Your decision

- **Nothing.** D-005 stays as it is, and so does the report.
- **Option 1 now.** It goes into `IDEAS.md` as Ready.
- **Option 2 later.** It goes into `IDEAS.md`, blocked until you choose a host, approve the privacy notice and reword D-005.
