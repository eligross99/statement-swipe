# Feature ideas & where they fit

Eli's feature ideas (Sept 2026), sorted by when to build them and why. On 2026-09-22 Eli **accepted
every "Proposed" change below**, approved the web-search link, and chose per-statement folders. Treat
"Proposed" items as decided. Read the relevant section before starting its phase.

On 2026-09-23 Eli added the **onboarding tour** idea and **accepted all five proposed changes** to it,
then approved the **easier statement import** plan (easier files first, bank connection later).
Treat both as decided.

On 2026-09-23 Eli also asked to schedule the **mobile polish** items from the Phase 5 design review
(text scaling, dark mode, haptics). See that section below. Eli also decided the app should
**eventually become an App Store app** (via Capacitor) at the start of Phase 9, but **ask Eli again
before starting that work**. See "Web app or App Store app?" below.

On 2026-09-23, after the Phase 5 phone test, Eli approved: a **Phase 5.5 "feel and motion"** batch
from their feedback, **on-device PDF import** as a priority in Phase 6 (their bank's app only offers
PDF downloads, so a CSV means a computer detour), and **renaming statements plus smart default
names** in Phase 6. Text scaling moved from Phase 6 into Phase 5.5.

On 2026-09-24, starting Phase 6, Eli approved **splitting Phase 6 into 6a (PDF import), 6b (multiple
statements) and 6c (Tasks dashboard and easier files)**, each phone-tested before the next, and
**moving Android "Share to" to Phase 7**, next to Android haptics, since both need an Android phone to
test. For tuning the PDF reader, Eli chose the **masked layout** approach (see "PDF statements").

On 2026-09-24 Eli phone-tested and approved Phase 6a (PDF import); it's merged. Its feedback also set
the card fly-out to 700ms, centered the swipe hint, and added "Show fewer" (see Eli's design notes in
`CLAUDE.md` and `src/lib/motion.ts`). **Next: Phase 6b in a fresh session. Start with "Starting Phase
6b" below.**

On 2026-09-24, starting Phase 6b, Eli chose: **no tab bar until Tasks exists** (Statements is the home
screen, gear for Settings; the Statements · Tasks bar arrives in 6c), **Settings starts with About &
privacy plus "Erase everything on this device"** (reminder age moves to 6c with Tasks; no "default
filter" setting, the screen remembers the last filter instead), and **filters All · Needs action ·
Archived** ("Last 6 months" waits until people have years of statements).

From Eli's 6b phone test (2026-09-24): no resume banner, rename only from the ⋯ menu, and one rule for
every breakdown bar (`ledgerSegments` in `src/lib/review.ts`): it reads like a progress bar, done on the
left (approved dark green, settled folder items pale green), still to do on the right (open folder items
indigo, flagged red, then unreviewed as empty track), and **a statement with nothing left to do is one
solid dark green**.

## Roadmap order

| Phase | What | Why here |
| --- | --- | --- |
| 4 | Triage & folder polish, **"Set status" menu**, consistent date display | Already planned; the status menu is the same UI |
| 5 | PWA finish, Vercel deploy, CI, test on phone | Gets the app into real use sooner |
| 5.5 | **Feel and motion:** smoother swipes and screen transitions, pressed states, overscroll bounce, larger and scalable text, clearer header buttons | Eli's phone-test feedback; the app works but feels abrupt |
| 6a | **PDF statements** | The only thing many phone users can download; plugs into the existing import screen, so it ships first |
| 6b | **Multiple statements:** storage, Statements screen, bottom navigation, Settings (light), **rename statements + smart default names** | Most new ideas depend on keeping more than one statement |
| 6c | **Tasks dashboard**; **easier files:** remembered bank setups, OFX/QFX files | Needs 6b's statement history |
| 7 | **Dark mode**, **haptics** and Android **"Share to"** first, then the **onboarding tour** (replaces the always-visible sample statement), with **per-bank download guides** | Needs the Phase 6 screens to exist; dark mode before the tour so the tour is designed once, in both themes |
| 8 | **On-device smarts:** familiar/new merchant tags, merchant-code decoder, web-search link, calendar reminders | Need statement history; no server needed; privacy stays intact |
| 9 | **App Store version** (Capacitor; ask Eli first), then accounts, backend, Stripe, **opt-in bank connection** (Teller → Plaid, relay-only server) (was Phase 6, then 8) | Unlocks push notifications and, if chosen, AI merchant explanations; App Store first because Apple's subscription rules shape the payment plan |
| 10 | Security & compliance (was Phase 7, then 9) | Unchanged |

## The ideas

### "Set status" menu → Phase 4
Rename "Set next step" to "Set status"; tapping opens a menu with To do / Waiting / Done (plus a way
to clear it). Agreed as-is.

### Starting Phase 6b: handoff notes from 6a (2026-09-24)
**Scope** (decided): Dexie storage with automatic migration of the saved review, the Statements
screen (see "Statements repository"), navigation (see "Navigation"), rename statements and smart
default names (see "Rename statements…"), and light Settings. Tasks dashboard, remembered bank
setups, and OFX/QFX stay in 6c.

**Open question (answered 2026-09-24: option a).** The approved navigation is bottom tabs *Statements ·
Tasks*, but the Tasks dashboard is scheduled for 6c. A tab bar with one tab looks unfinished. Options to
put to Eli, with a recommendation: (a) in 6b, make Statements the home screen with the gear for Settings
and no tab bar, then add the tab bar in 6c with Tasks (recommended: nothing half-built ships); (b) move
the Tasks dashboard into 6b.

**What 6a left in place that 6b builds on:**
- **Migration source:** the current review is one `Session` blob in idb-keyval under
  `statement-swipe-session-v1`, with undo steps under `statement-swipe-undo-v1` (`src/lib/storage.ts`).
  Dexie is pre-approved in `CLAUDE.md`'s stack. Migrate both keys into the first saved statement.
- **Smart default names:** imports are named after the file today (`labelFrom` in
  `ImportScreen.tsx`, e.g. "eStmt_2026-07-13"). PDF imports also know the statement's closing date
  (`PdfStatement.closing`), which is a better source for "July 2026" than purchase dates. The bank name
  can join the default once bank setups are remembered (6c).
- **The "Replace your review?" sheet** (`ImportScreen.tsx`) exists because there's only one saved
  review. With multiple statements, importing adds a statement instead, so this sheet should go away
  (keep asking before *deleting* a statement).
- **Categories:** statements without categories use the placeholder `cat: '—'`, hidden everywhere
  via `hasCategory` (`src/lib/format.ts`). Keep using it on new screens.
- **Testing:** `npm run test:e2e` (Playwright WebKit, iPhone-sized, live CSP) runs on CI; add a spec for
  the Statements screen. Try each change in the iPhone simulator's Safari before Eli's phone test.
  Eli's real statement stays in `private/statement.pdf` (git-ignored); the private tests check it
  reporting counts only.

### Statements repository → Phase 6b
One screen listing every imported statement, with:
- Tags: **New · needs review**, **In progress**, or a completed summary (flagged / to do / waiting
  counts, or a green **✓ Clear**).
- Tapping opens the right place: first card (new), where you left off (in progress), or the summary (done).
- Filters: **Needs action**, **Last 6 months**, **Archived**.
- Archive, and delete with an "Are you sure you want to delete [name]?" Delete / Cancel dialog.

**Proposed changes:**
- **One list style to start, not list + card toggle.** At phone width the two look nearly the same,
  and two layouts double the design and testing work. Build rich list rows; add a toggle later if missed.
- **Archive and Delete in a "⋯" menu on each row**, not a visible trash icon. That's less clutter and
  fewer accidental taps. The confirmation dialog stays.
- Statement dates (for "last 6 months") come from the purchase dates in the file, which is why Phase 4
  makes date handling consistent first.

**Technical note:** this replaces "one saved session" with "many saved statements". That's a
data-model change and the planned switch from `idb-keyval` to Dexie (the handoff already names Dexie
for statement history). An existing in-progress review gets migrated automatically.

**Decided:** folders stay per statement (simpler, and the Tasks dashboard already
gives the cross-statement view), but offer your past folder names as one-tap choices when filing.

### Navigation → Phase 6b (see the open question in "Starting Phase 6b")
**Proposed instead of Statements / Swipe / Settings tabs:**
- **Bottom tabs: Statements · Tasks.** Tabs are for places you visit often.
- **No "Swipe" tab.** Swiping belongs to one specific statement, so the tab would be empty or confusing
  when nothing is in progress. Instead, tapping any statement opens it (per the rules above). A
  "Pick up where you left off" banner was built in 6b, then **removed after Eli's phone test**: it
  repeated a row already on the screen.
- **Swiping is full-screen with the tab bar hidden**, with a back arrow. That gives the cards more
  room, and the swipe-up gesture doesn't compete with the tab bar.
- **Settings behind a gear icon in the top-right corner**, the common pattern for rarely visited
  screens.
- **"+ Import"** button on the Statements screen.

### Tasks dashboard → Phase 6c
Every open purchase across completed statements, grouped **Flagged · To do · Waiting · Done**, each
linking back to its statement and folder. "Remind me after X" is a preference; until push
notifications exist, open items past that age get an **Overdue** highlight and a count badge on the
Tasks tab.

**Gap found in 6b, to solve here:** a flagged purchase has no "resolved" state. The only way out is
"I recognize it, approve it", so a statement with a real fraud charge (disputed, refunded) stays in
**Needs action** forever. Tasks needs a way to mark a flagged purchase as handled (e.g. "Disputed with
my bank"), which then counts as clear.

### Settings / preferences → Phase 6b (start light)
**Built in 6b:** "About & privacy", "Erase everything on this device", and a "Suggest past folder names"
switch (on by default; Eli, 2026-09-24). Folders stay per statement either way: the switch only controls
whether names used before are offered as one-tap choices ("Names you've used before") when filing.
Eli considered a "save folders across statements" setting; Claude recommended against shared folders
(a data-model change that overlaps the 6c Tasks dashboard) and pre-made empty folders (clutter, no
tap saved), and Eli chose the suggestion switch instead. Reminder age comes with Tasks
(6c); the Statements filter is remembered instead of being a setting (Eli, 2026-09-24).
Originally planned: reminder age (e.g. 1 month), default statement filter, and "About & privacy".
**Proposed:** no Account or Plan sections until accounts and payments exist (Phase 9). Empty
placeholder screens make an app feel unfinished.

### Onboarding tour → Phase 7 (accounts part → Phase 9)
Eli's idea (2026-09-23): first-time users make an account, then take a quick guided tour of the key
navigation and features, using the sample statement's dummy data. The tour can be replayed any time
later. "Try the sample statement" is no longer offered outside the tour.

**Agreed:**
- A tour that uses the sample statement is the right way to teach the swipe gestures. People learn
  them by doing, with fake data, before they trust the app with a real statement.
- Replayable later, from Settings ("Replay the tour").
- Removing the standalone sample button: once the tour exists, it's the one place sample data lives.

**Proposed changes (accepted 2026-09-23):**
- **No account before the tour. Accounts come in Phase 9, and only when they're needed.** Asking
  new users to sign up before they've seen anything is where many drop off. It would also break the
  "your statement never leaves your device" promise if an account were required just to use the app,
  and accounts need the backend that doesn't exist until Phase 9. Instead: tour first, then use the app
  with no account. Once accounts exist, offer to create one when it unlocks something (sync between
  devices, backup, a paid plan).
- **Interactive and short, not a slideshow.** About 5 steps on the sample deck, each asking the
  user to do the real thing: swipe right (approve), swipe left (look closer), swipe up (make a folder),
  set a status in that folder, then a quick look at the Statements and Tasks tabs. A **Skip** button
  on every step; skipping marks the tour as seen.
- **End with "Get your statement"**: short instructions for downloading a CSV from your card's
  website, then the Import screen. Getting the file is the biggest real-world hurdle, so the tour
  should end there.
- **The tour's sample statement is a sandbox.** It never appears in the Statements list, the
  Tasks dashboard, or "familiar merchant" counts, and it's thrown away when the tour ends.
- **Build it after Phase 6**, because the tour has to show the Statements/Tasks navigation that
  Phase 6 creates. Until then, keep the "Try the sample statement" button. It's how Eli (and testers)
  will try the app on the phone in Phase 5. The sample data stays in the code for automated tests.

### Easier statement import → Phases 6a–7 (files), Phase 9 (bank connection)
Eli's goal (2026-09-23): getting a statement into the app should be easier than "download a CSV from
the bank's website, save it, upload it". **Approved plan:** make files painless first (no server
needed), then add an opt-in bank connection once accounts and a backend exist.

**Phase 6c: easier files** (goes with statement history, since it needs saved settings)
- **Remember each bank's setup.** After the first import, save the detected column mapping, sign
  convention, and header row, keyed by the file's header row (e.g. "Chase card CSV"). The next import
  from the same bank skips the mapping screen: one tap to start. Settings stay on-device.
- **Accept OFX/QFX files** (Quicken formats many banks offer next to CSV). They're standardized, so
  there's no column mapping. Add an `OFXSource` behind the existing `TransactionSource` seam; nothing
  downstream changes. Keep real files out of the repo (already blocked in `.gitignore`); use synthetic
  fixtures.
- **"Share to Statement Swipe" on Android → moved to Phase 7** (2026-09-24), next to Android haptics, so
  both Android features are tested together on one Android phone. A `share_target` entry in the web-app manifest lets the
  installed app receive a shared file straight from the Files/Downloads app. iPhone doesn't support
  this for web apps; there the file picker already opens to recent downloads, so no workaround needed.

**Phase 7: per-bank download guides**
- Short step-by-step guides for the most common US card issuers (e.g. "Chase: Accounts → Download
  account activity → CSV"). Shown at the end of the onboarding tour ("Get your statement") and from a
  "How do I get my file?" link on the Import screen. Guides are static text in the app: no network.
- Check each guide against the bank's real site before shipping, and keep them easy to update, since
  banks move their download buttons.

**Phase 9: opt-in bank connection** (needs accounts and a backend)
- **How it works:** the user taps "Connect card" and logs in to their bank inside Teller's or Plaid's
  own secure window (our app never sees the password). The service gives our server a token
  (a lasting permission to fetch that card's transactions). New transactions then arrive with no files.
- **Teller first** (simpler, US-only), **then Plaid** for wider bank coverage. Plaid's enrichment can
  also supply real merchant names, logos, and locations, which solves cryptic descriptors like
  `SQ *DD BAR` properly (see "Merchant lookup"). Plaid can report the card's billing-cycle dates, so a
  review can match the real statement period.
- **Relay-only server, to keep the privacy promise as close as possible:** the server stores only the
  encrypted token, fetches transactions, and passes them to the device without keeping a copy. The
  review, folders, and notes stay on-device. The promise for connected users becomes: "Your
  transactions are stored only on your device. We don't keep them." Update `CLAUDE.md`'s privacy
  section and the in-app privacy text when this ships.
- **Opt-in, never required.** File import stays for anyone who doesn't want to connect a bank.
- **Costs and approvals:** the aggregators charge per connected account (usually monthly), so this
  belongs in the paid plan. Plaid reviews security and privacy practices before granting production
  access, which lines up with Phase 10 (security and compliance with legal counsel).
- Out of scope: Apple FinanceKit (native iOS apps only, few cards), screen-scraping bank websites.

### Reminders → Phase 8 (calendar), Phase 9 (push)
**Constraint:** a web app can't reliably fire a notification at a future time without a server
sending it (and on iPhone, only once the app is installed to the home screen).
**Proposed:** Phase 8 adds a **"Remind me"** button on a folder item that creates a calendar event
(e.g. "Venmo request Jared for dinner, 9/8") in your phone's own calendar app with an alert. No
server needed. Real push notifications come with the backend in Phase 9.
Note: if your calendar syncs to iCloud/Google, the reminder text goes there. That's your choice per
reminder, but the app should say so.

### Merchant lookup ("Look closer") → Phase 8 partly, Phase 9+ for AI
**Conflict:** the privacy rule says transaction descriptions never leave the device. Sending the
merchant name to an AI service would break that promise and needs a server (to hide the API key) and
money per lookup. AI answers about cryptic merchant codes can also be confidently wrong.
**Proposed:**
1. **Phase 8: merchant-code decoder, on-device.** A built-in list of payment-processor prefixes.
   E.g. `SQ *` = Square (small businesses), `TST*` = Toast (restaurants), `AMZN MKTP` = Amazon
   Marketplace, `PAYPAL *`, `SP *` = Shopify store. This is accurate, instant, and works offline.
2. **Phase 8: "Search the web" link** that opens your browser with only the merchant name, and only
   when you tap it. Approved; the privacy rule in `CLAUDE.md` allows this one explicit, user-initiated case.
3. **Phase 9+: optional AI explanation**, off by default, with a clear note that only the merchant name
   is sent. Or get real merchant names and logos from bank-sync enrichment (Plaid), which solves the
   same problem more reliably.

### Familiar merchant tag → Phase 8
Shown on swipe cards when a merchant appears in 3+ past statements. All on-device.
**Proposed changes:**
- Word it as **"Seen in 5 statements"**, not "Recognized vendor". Fraud can happen at a familiar
  merchant too (e.g. Amazon), so the tag shouldn't imply "safe".
- Also add the reverse: a **"New merchant"** tag, which is often the stronger fraud signal.
- Match names loosely (`SHELL OIL 574123900` and `SHELL OIL 574123911` are the same merchant) by
  ignoring store numbers.

### Mobile polish → Phases 5.5–7
From the Phase 5 mobile design review (the `mobile-design` skill in `.claude/skills/`).
- **Text that follows the phone's text-size setting → moved to Phase 5.5** (see that section).
- **Dark mode → start of Phase 7.** Follow the phone's light/dark setting by default, with an
  override in Settings (System · Light · Dark). All colors already live in `src/styles/tokens.css`,
  so this is mostly a second set of token values plus contrast checks (4.5:1 for text). Keep the
  calm, green identity: a deep green-black background, not pure black. Before the tour, so the
  tour is designed once in both themes.
- **Haptics (a small vibration when a swipe lands) → Phase 7.** Works on Android through the
  browser's vibration feature. iPhone browsers don't allow it for websites, so on iPhone it only
  comes with an App Store version (see "Web app or App Store app?" below).

### Web app or App Store app? → start of Phase 9 (ask Eli first)
> **Reminder: ask Eli again before starting this.** Confirm they still want it, and walk through
> the costs and steps, before creating developer accounts or setting up Capacitor.

**Today** the app is a PWA (progressive web app): a website that installs to the home screen, opens
full-screen, and works offline. Swiping and everything else in the core experience work the same as
in a native app.

**What a PWA can't do well, mostly on iPhone:** installing is hidden in Safari's Share menu (the
biggest drawback), there's no App Store listing (less built-in trust for a finance app), no haptics,
no Face ID lock, and notifications only work once installed.

**Decision (2026-09-23):** Eli expects to publish an App Store version eventually, and agreed to wait
until Phase 9. Until then the PWA lets us ship fixes in minutes without Apple's review.
- **How:** wrap this same React app with **Capacitor**, which turns a web app into real iPhone and
  Android apps and adds native features (haptics, Face ID) through plugins. Almost all code is
  reused. Not React Native, which would mean rebuilding the interface.
- **Why at the start of Phase 9:** Apple has rules about how subscriptions are sold inside App Store
  apps, so the Stripe/payment design should know whether we're in the App Store.
- **Costs to review with Eli then:** Apple Developer Program (about $99/year), Google Play (one-time
  fee), Apple's review on every update, and a Mac with Xcode for iPhone builds.
- Keep the PWA running alongside it: same code, and it stays the quickest way to try the app.

### Vercel plugin for Claude Code → start of Phase 9
Vercel's official Claude Code plugin (`npx plugins add vercel/vercel-plugin`, needs Bun) adds skills
for server functions, databases, auth, env vars, and deployments. Eli suggested it on 2026-09-23;
we deferred it because a static Vite app uses almost none of it. **Install it at the start of
Phase 9**, when we add the backend, Stripe, and the bank-connection relay.

### Feel and motion → Phase 5.5 (built 2026-09-23)
From Eli's first phone test (2026-09-23). All 12 items below are built; the header's new button is a
labeled "New statement" pill, and the card "leans" toward Look closer or File while they're open. The app works, but it feels abrupt: things change
instantly, so it's hard to see what just happened. Principles:
- **React instantly, then let the result be seen.** No delay before a response. The dragged card
  follows the finger 1:1. After the finger lifts, motion is slower and eased (roughly 250–400ms,
  decelerating) so the user sees where things went. Not so slow that it drags.
- **Every change of screen is a transition** (slide, rise, or fade), never an instant swap.
- **Every tap gets visible feedback**, even where it isn't strictly needed.
- **Reduce Motion** (phone setting) swaps movement for quick fades. Already respected globally in `index.css`.

Items:
1. **Swipe fly-out:** slower and smoother after release (now 260ms ease-in; aim ~350ms ease-out).
2. **Look closer opens and closes with a slide** (like pushing a page in an iPhone app), not an instant swap.
3. **Answering in Look closer:** slide back to the deck, a brief pause showing the same card, then it
   flies right (approve) or left (flag). About half a second total, so the user can confirm what happened.
4. **Undo:** the card flies back in from the side it left, so it's clear which purchase returned.
5. **Action buttons:** stronger pressed state (especially Look closer and File, whose light tints barely
   change), and tapping one sends the card off in the matching direction, like a swipe.
6. **Last card → summary:** the summary rises in instead of appearing instantly.
7. **Overscroll bounce:** `overscroll-behavior: none` on `body` (added to stop page movement while
   dragging cards) also removed iOS's "held back" bounce on still pages. Restore the bounce on pages;
   keep it off only on the card (`touch-action: none` already covers the card).
8. **Header, top right:** the Upload icon was unclear, and Eli thought tapping it lost their progress
   (it didn't: the import screen has a Resume button, but it's easy to miss). Use a clearer icon and
   name ("New statement"), give the import screen an obvious way back to the review, and **confirm
   before a new file replaces an unfinished review**.
9. **Folder screen:** the header's top-left button is a disabled undo there, which confused Eli. On the
   folder screen it becomes the "back to all folders" button (always visible at the top), and the
   in-page "All folders" link goes away.
10. **Text size:** secondary gray text is too small even with default iPhone settings. Raise the small
    sizes (12–13px → about 14–15px). While touching every size, switch to `rem` and set the base with
    `font: -apple-system-body` on iPhone so text follows the phone's text-size setting (Dynamic Type).
    Test at the largest sizes: nothing may be cut off.
11. **CSV screen:** removing the chosen file fades it out; changing a column briefly highlights the
    field, and the preview updates visibly.
12. **Look for more:** e.g. the progress bar animates as it fills; changing a status pulses the row.
    Keep it subtle.

### One purchase in several folders → later (Phase 8 at the earliest)
Eli asked (2026-09-24) about filing one purchase into two folders, e.g. "Restaurants" and "Venmo
requests". **Decision: not now.** Each purchase has one folder and one status (To do / Waiting /
Done), so multiple folders would need a status per folder, new summary math (no double-counting),
and a reworked filing sheet. Most such cases are really a *label* for tracking spending (like
"Restaurants") alongside one *to-do* folder. Revisit as tags with the Phase 8 on-device smarts.

### PDF statements → Phase 6a (priority)
**Why:** Eli's bank app only offers PDF statements on the phone. Getting a CSV means downloading on a
computer and sending it to the phone, which is too many steps for anyone who isn't a friendly tester.
This reverses the old "PDF is out of scope" decision (`docs/handoff.md` §12).
- **On-device, like CSV:** read the PDF inside the app with Mozilla's PDF reader (`pdfjs-dist`, a new
  dependency Eli approved), loaded only when someone picks a PDF. Nothing is uploaded.
- **Phone flow:** bank app → share or save the PDF to Files → "Choose a file" in our app.
- **How:** statements are computer-generated PDFs with real text (not scanned images). Extract the text
  lines and pick out purchase rows (date, description, amount), skipping payments and credits. Show
  the existing preview so the user confirms before reviewing. Scanned/image PDFs: a clear message
  saying they can't be read, with what to do instead.
- **Honest risk:** every bank's layout differs, so some will parse imperfectly at first. Build against
  synthetic PDFs in `tests/fixtures/` (update `.gitignore`, which currently blocks all `*.pdf`) and test
  Eli's real statement **locally only, never committed** (the repo is public).
- **Not instead of** bank connection (Phase 9) or download guides (Phase 7); it's the quickest fix
  that keeps the privacy promise.
- **Built (6a):** rows are found by pattern (a date first, an amount last, under section headings like
  "Payments and Other Credits" or "Purchases"), and years come from the closing date, so a
  December–January statement dates correctly. The statement's printed purchases total is checked
  against what was found, and the preview says whether they match. That's how a user (or Eli, on a
  real statement nobody else sees) knows the read is complete.
- **Masked layout (chosen 2026-09-24):** to tune the reader on Eli's real Bank of America PDF without
  sharing it, `scripts/pdf-layout.ts` prints its layout with letters as X and digits as 9 (common
  statement words kept). Only that masked output is shared with Claude. Result on Eli's July–August
  2026 statement: every dated row accounted for, and the purchases found match the printed total to the
  cent. `src/sources/pdfSource.private.test.ts` re-checks it (counts only) whenever tests run on Eli's Mac.

### Rename statements and smart default names → Phase 6b
- **Rename** from each statement's "⋯" menu on the Statements screen. Any name, e.g. "July 2026 Bank of
  America Credit Card Statement". (Renaming by tapping the review's title was built, then removed after
  Eli's phone test: the pencil icon looked like an edit mode, and a tap-only title is a hidden feature.)
- **Smart default names** instead of the file name: from the purchase dates, plus the bank name once
  bank setups are remembered, e.g. "July 2026 Bank of America". Likely enough for most people.
- **Later (nice-to-have):** a custom naming pattern in Settings, so users never rename by hand.

