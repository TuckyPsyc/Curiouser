# Ideas

The Developer's backlog, in order. Once a week the Developer builds the first item marked **Ready** and sends Carl a pull request. It never merges; merging is Carl's approval.

**To change the order, move a whole item up or down.** On your phone: open this file on GitHub, tap the pencil, cut an item and paste it higher or lower, then tap Commit changes. Or tell Claude: "Move the web version to the top of IDEAS.md."

Each item has a status:

- **Ready**: the Developer can build it, and it reaches phones over the air once merged.
- **Blocked: needs a decision**: waiting for Carl to decide or set something up.
- **Blocked: needs an APK**: it needs native code, so every reader would have to reinstall (D-008).
- **Blocked: needs accounts or a server**: it can't be done on the phone alone, which means changing D-005 and D-011, and moving stories out of the public repository first (D-001).

To unblock an item, change its status to **Ready** (and say what you decided), or ask Claude to.

## The list

### 2. Web version on GitHub Pages
**Status:** Blocked: needs a decision
The same app in a browser, for friends on iPhone (D-006). The workflow exists (`web.yml`) but only runs by hand. **What's needed from Carl:** in the repository's Settings → Pages, set Source to "GitHub Actions". After that the Developer can make it publish on every change and add a link to the README.

### 3. Google Play internal testing
**Status:** Blocked: needs a decision
Up to 100 testers, with normal Play Store installs and updates. **What's needed from Carl:** a Play developer account ($25, one-off) and agreement to a private signing key. The new key fixes D-002, but friends would have to uninstall and reinstall once, so it also **needs an APK**.

### 4. Read to me
**Status:** Blocked: needs a decision
An AI narrator reads the story aloud. **What's needed from Carl:** a choice of voice (original, never a soundalike of a real person, and labelled as AI). Playing audio also **needs an APK**.

### 5. The friends leaderboard
**Status:** Blocked: needs accounts or a server
Compare Caucus-race scores with friends. Scores live only on each phone today (D-011).

### 6. The Looking-Glass vote
**Status:** Blocked: needs accounts or a server
Readers vote on whether the other side changed their mind, and see how everyone voted.

### 7. Un-birthday presents
**Status:** Blocked: needs accounts or a server
Gift a friend a free month. Needs accounts, and payments.

### 8. Subscriptions and founding-reader pricing
**Status:** Blocked: needs accounts or a server
A paid tier, with the first 100 readers keeping a lower price for good. Needs accounts, payments, and stories moved out of the public repository (D-001), or anyone can read them free.

### 9. Tea Party
**Status:** Blocked: needs a decision
A way to discuss the day's story. A discussion inside the app needs accounts and a server. A lighter version could ship over the air: a button that shares the day's talking point to WhatsApp or Messages, so the conversation happens where friends already are. **What's needed from Carl:** which of the two he wants.

## Suggested while building the agent team

Found on 11 November 2026 while setting up the fact-checker and the desk. Lower priority unless Carl moves them up.

### 10. A reminder that doesn't promise a story on a morning without one
**Status:** Ready
The 7:00 reminder always says "Today's story is waiting". On a morning when the story was held or unchecked, that isn't true (D-012). Reword it so it's true either way.

### 11. "Checked" on each story
**Status:** Ready
Show readers that a story was independently checked, with the date, and say so honestly when it was released unchecked. The verdicts are already in `content/checks/`.

### 12. Write to the editor
**Status:** Blocked: needs a decision
A link in the app that opens an email to Curiouser. **What's needed from Carl:** the address (see Support).

## Done

The Developer moves an item here in the pull request that builds it.

### Caucus-race reminder on Sunday mornings
**Done:** 11 November 2026.
A second reminder at 9:00 on Sunday mornings, telling readers the week's Caucus-race is open. It uses the notification library already in the app and is scheduled on the phone, like the 7:00 reminder, with its own switch (the Dodo) on the Shelves.
