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

## Roadmap order

| Phase | What | Why here |
| --- | --- | --- |
| 4 | Triage & folder polish, **"Set status" menu**, consistent date display | Already planned; the status menu is the same UI |
| 5 | PWA finish, Vercel deploy, CI, test on phone | Gets the app into real use sooner |
| 6 | **Multiple statements:** storage, Statements screen, bottom navigation, Tasks dashboard, Settings (light); **easier import:** remembered bank setups, OFX/QFX files, Android "Share to"; **text that scales** with the phone's text-size setting | Most new ideas depend on keeping more than one statement; new screens get scalable text from the start |
| 7 | **Dark mode** and **haptics** first, then the **onboarding tour** (replaces the always-visible sample statement), with **per-bank download guides** | Needs the Phase 6 screens to exist; dark mode before the tour so the tour is designed once, in both themes |
| 8 | **On-device smarts:** familiar/new merchant tags, merchant-code decoder, web-search link, calendar reminders | Need statement history; no server needed; privacy stays intact |
| 9 | **App Store version** (Capacitor; ask Eli first), then accounts, backend, Stripe, **opt-in bank connection** (Teller → Plaid, relay-only server) (was Phase 6, then 8) | Unlocks push notifications and, if chosen, AI merchant explanations; App Store first because Apple's subscription rules shape the payment plan |
| 10 | Security & compliance (was Phase 7, then 9) | Unchanged |

## The ideas

### "Set status" menu → Phase 4
Rename "Set next step" to "Set status"; tapping opens a menu with To do / Waiting / Done (plus a way
to clear it). Agreed as-is.

### Statements repository → Phase 6
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

### Navigation → Phase 6
**Proposed instead of Statements / Swipe / Settings tabs:**
- **Bottom tabs: Statements · Tasks.** Tabs are for places you visit often.
- **No "Swipe" tab.** Swiping belongs to one specific statement, so the tab would be empty or confusing
  when nothing is in progress. Instead, a **"Resume: March 2026 · 8 left"** banner sits at the top of
  Statements, and tapping any statement opens it (per the rules above).
- **Swiping is full-screen with the tab bar hidden**, with a back arrow. That gives the cards more
  room, and the swipe-up gesture doesn't compete with the tab bar.
- **Settings behind a gear icon in the top-right corner**, the common pattern for rarely visited
  screens.
- **"+ Import"** button on the Statements screen.

### Tasks dashboard → Phase 6
Every open purchase across completed statements, grouped **Flagged · To do · Waiting · Done**, each
linking back to its statement and folder. "Remind me after X" is a preference; until push
notifications exist, open items past that age get an **Overdue** highlight and a count badge on the
Tasks tab.

### Settings / preferences → Phase 6 (start light)
Start with: reminder age (e.g. 1 month), default statement filter, and "About & privacy".
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

### Easier statement import → Phases 6–7 (files), Phase 9 (bank connection)
Eli's goal (2026-09-23): getting a statement into the app should be easier than "download a CSV from
the bank's website, save it, upload it". **Approved plan:** make files painless first (no server
needed), then add an opt-in bank connection once accounts and a backend exist.

**Phase 6: easier files** (goes with statement history, since it needs saved settings)
- **Remember each bank's setup.** After the first import, save the detected column mapping, sign
  convention, and header row, keyed by the file's header row (e.g. "Chase card CSV"). The next import
  from the same bank skips the mapping screen: one tap to start. Settings stay on-device.
- **Accept OFX/QFX files** (Quicken formats many banks offer next to CSV). They're standardized, so
  there's no column mapping. Add an `OFXSource` behind the existing `TransactionSource` seam; nothing
  downstream changes. Keep real files out of the repo (already blocked in `.gitignore`); use synthetic
  fixtures.
- **"Share to Statement Swipe" on Android.** A `share_target` entry in the web-app manifest lets the
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

### Mobile polish → Phases 6–7
From the Phase 5 mobile design review (the `mobile-design` skill in `.claude/skills/`).
- **Text that follows the phone's text-size setting → Phase 6.** Today font sizes are fixed pixels,
  so turning up text size in the phone's settings doesn't enlarge the app's text. Switch sizes to
  `rem` (sizes relative to the base text size) and, on iPhone, set the base with
  `font: -apple-system-body` so it follows Dynamic Type (Apple's text-size setting). Test at the
  largest sizes: cards, amounts, and sheets must wrap or scroll rather than cut text off.
  Do it in Phase 6 because that phase adds most of the new screens.
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

