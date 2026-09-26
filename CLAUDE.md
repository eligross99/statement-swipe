# Statement Swipe

A mobile-first PWA for reviewing a credit-card statement one card at a time, dating-app style:
**right = recognized**, **left = investigate**, **up = file into a folder**. After the review, users
triage folders (split with friends, reimburse, taxes) with a status and a note per purchase.
Local-first: **the user's statement never leaves their device.**

- Full product and engineering brief: `docs/handoff.md`. Read the relevant section before starting a phase.
- Design techniques we've adopted, with the reasons behind them: `docs/design-notes.md`. Read it before any UI work.
- Feature ideas beyond the handoff, with decisions and target phases: `docs/ideas.md`. Read it before phases 6 through 9.
- Reference prototype (the UI/interaction source of truth): `docs/prototype/StatementSwipe.jsx`.
  It is a single-file Claude-artifact prototype. Port its behavior faithfully. Do not import from it.

## Working with Eli

- Eli is new to coding and relies on Claude to drive and to follow best practices. Explain what
  you are doing and why in plain language, briefly, and define jargon the first time it comes up.
- Be proactive: recommend the next step and flag when something should happen (a commit, a fresh
  session, a test on the phone). Give a recommendation, not a menu of options.
- When Eli must do something themselves (logins, phone testing, account setup), give exact steps.
- Ask before: pushing to GitHub, adding a new dependency not listed below, deleting files,
  or anything involving accounts, money, or deployment settings.

## Stack

- React + Vite + **TypeScript** (strict mode)
- `vite-plugin-pwa`: installable, works offline
- `dexie`: IndexedDB persistence, one row per statement (`src/lib/storage.ts`). `idb-keyval` stays only to
  move a review saved before Phase 6b; it can go once that's no longer needed
- `papaparse`: CSV parsing · `pdfjs-dist`: PDF statements, loaded only when a PDF is picked · `lucide-react`: icons
- Vitest + Testing Library for unit/component tests; Playwright (WebKit, iPhone-sized) for end-to-end tests in `e2e/`
- Hosting: Vercel (auto-deploys from GitHub; set up in the PWA-finish phase)

## Commands

- `npm run dev`: local dev server
- `npm run build`: typecheck + production build
- `npm test`: unit tests (Vitest, once) · `npm run test:watch`: re-run on save
- `npm run test:e2e`: end-to-end tests of the production build in WebKit (run `npm run build` first;
  first time on a new machine: `npx playwright install webkit`). Also runs on CI
- `npm run typecheck`: TypeScript only
- `npm run preview`: serve the production build (the only mode where the PWA/service worker is active)
- `npm run lint`: lint (oxlint; `docs/` is excluded)
- `sh scripts/make-icons.sh`: regenerate the PNG app icons from the SVGs in `public/` (macOS)
- `node scripts/make-pdf-fixtures.ts`: regenerate the synthetic PDF statements in `tests/fixtures/`
- `node scripts/pdf-layout.ts private/statement.pdf`: print a real statement's layout with names and
  numbers masked, for tuning the PDF reader. Real statements go in `private/` (git-ignored), never in `tests/`.
  `npm test` also checks every PDF in `private/` adds up to its printed total, reporting counts only
  (`src/sources/pdfSource.private.test.ts`; skipped on CI)

Deploys, CI, security headers, and the phone test checklist: `docs/deploy.md`.

## Architecture rules

- **Data source seam:** all ingestion goes through a `TransactionSource` interface that returns a
  normalized `Transaction[]` (`CSVSource` now; Teller/Plaid later). Nothing downstream (deck,
  folders, summary, triage) may know where transactions came from.
- **Data model** lives in one types file (`src/types.ts`) and matches `docs/handoff.md` §7 (`Transaction`,
  `Pile`, `Session`, `Status`, `Action`), plus `Statement`: one imported statement wrapping its `Session`
  (name, dates, archived, undo steps). A `Session` no longer has a `label`; the name lives on the `Statement`.
  `Transaction.actionAt` (when it was filed, flagged, or last changed status) drives Overdue in Tasks.
- **State:** `libraryReducer` (`src/lib/library.ts`) holds every statement, which screen is showing, and the
  last tab (`home`, where Back returns), and hands review events to `reviewReducer` (`src/lib/review.ts`) for
  the open statement, or for statement `id` when Tasks changes one that isn't open. The Tasks list is derived
  from the statements by `allTasks` (`src/lib/tasks.ts`), never stored.
- **Persistence:** `useLibrary` saves changed statements to IndexedDB (debounced, flushed when the app is
  hidden) and restores them, plus where the user was, on load.
  The prototype's `window.storage` only exists inside Claude artifacts and must not appear in this code.
- **Keep logic out of components:** CSV parsing, column detection, and state transitions (approve,
  pile, flag, undo, delete folder) are plain TypeScript functions with unit tests. Components render.
- **Invariants to preserve and test:**
  - Every transaction reaches a terminal state (`approved | piled | flagged`) before the session completes.
  - Swipe left opens the investigation view. It never dismisses the card.
  - Deleting a folder reverts its items to `approved` with `pileId: null`. Never lose review state.
  - Folders belong to one statement and start empty (past folder names are offered when filing).
  - "Still to act on" = sum of a folder's items whose action is not `done`.
  - A flagged purchase marked `done` is resolved: it counts as done in `progress`, `ledgerSegments`,
    and Tasks. Flagged and filed purchases share the To do / Waiting / Done statuses.

## Privacy (non-negotiable)

- No transaction data (descriptions, amounts, dates, notes) is ever sent over the network: no
  logging services, no analytics payloads, no third-party APIs. Analytics, if added, are anonymous
  event names only (e.g. `review_completed`).
- One exception: a "Search the web" link may open the user's browser with **only the merchant name**,
  and only when the user taps it. Never amounts, dates, notes, or anything automatic.
- **This GitHub repo is public.** Never commit real statements or personal financial data.
  `.gitignore` blocks `*.csv`/`*.ofx`/`*.qfx`/`*.pdf`. Test data must be synthetic and live in `tests/fixtures/`.

## Design

**This supersedes the dark "ink deck" design in `docs/handoff.md` §9.** Eli chose a white-and-green
direction: calm, clear, efficient, and signaling financial well-being.

**Record design techniques (every session):** `docs/design-notes.md` is the running record of how the app
is designed: patterns, motion values, and the phone-test feedback behind them. Whenever a UI change adds
or changes a technique (a new animation, control style, layout pattern, or wording rule), add or update
its entry there in the same commit, with what it is, why, and where it lives in the code.

- All colors live in `src/styles/tokens.css` as CSS custom properties. Never hard-code hex values in components.
- **Light and dark themes** (Phase 7a): every color token needs a value in both blocks of `tokens.css`.
  `src/styles/tokens.test.ts` checks text contrast (4.5:1) in both; add new text/background pairs to it.
- Text sizes are the `--text-*` tokens (rem, so they follow the phone's text-size setting). Never set
  font sizes in px; cap with `min()` only inside fixed-size areas like the swipe card.
- White cards on a near-white, faintly green background (`--bg`). One deep "money green" brand color (`--brand`).
  Generous whitespace; soft shadows; no heavy borders.
- Action colors are functional and consistent everywhere (each has a `-tint` for soft fills):
  approve = brand green, investigate = amber, pile = indigo, fraud = red, waiting = blue.
  Approve is the only solid-filled action (the "healthy default"); others use tint backgrounds.
- Amounts are the largest element on a card and use tabular figures (`.num` class), in the system sans font.
- Keep the signature feel: tilt on drag, fading directional stamps, 1–2 peek cards behind the top card.
- Motion: react instantly (a dragged card follows the finger 1:1), then let the result be seen:
  eased transitions of roughly 250–400ms. Screens never swap instantly, and every tap shows feedback.
  Respect Reduce Motion.
- Mobile-first (~400px). Touch targets ≥ 44px. Every gesture has a button and arrow-key fallback, plus undo.
- Words and labels (from the `frontend-design` skill in `.claude/skills/`): sentence case, no all-caps
  labels (the swipe stamps are the one exception), no "A · B · C" meta strings, no "→" on buttons.
  One name per action everywhere: **Approve**, **Look closer**, **File**, **Flag as possible fraud**.
  Buttons say what happens; empty and error states tell the user what to do next.
- Destructive actions (start over, delete a folder with purchases) always ask first.
- The app's colors also appear in `vite.config.ts` (manifest `theme_color`/`background_color`),
  `index.html` (`theme-color`), `public/theme.js` and `THEME_COLOR` in `src/lib/theme.ts` (both themes'
  `--bg`), and the icon SVGs, which can't read CSS variables. Keep them in sync with `--bg`/`--brand`.

## Workflow

- One roadmap phase per branch (`phase-1-scaffold`, `phase-2-port`, …), merged to `main` via a PR.
  A phase too big to phone-test in one go is split into parts (Phase 6 → `phase-6a-pdf-import`, 6b, 6c),
  each with its own branch, PR, and phone test.
- Before asking Eli to phone-test a PR, try it in the iPhone simulator's Safari (see Gotchas). When
  sending the preview link, remind Eli to pull down to refresh once or twice: the service worker
  keeps serving the previous version until the new one has downloaded.
- Small commits with clear messages. Before each commit: `npm run build`, `npm test`, and `npm run lint` pass.
- Verify UI changes by running the app in the browser at phone width, not just by reading code.
- After design feedback or a UI change, update `docs/design-notes.md` (see Design).
- At the end of each phase, update the Roadmap status below, then start a fresh Claude session.

## Roadmap status

See `docs/handoff.md` §11 for details.

- [x] 1. Scaffold Vite + React + TS PWA with the stack above
- [x] 2. Port prototype; replace `window.storage` with IndexedDB
- [x] 3. Harden CSV import (header-row detection, `TransactionSource`/`CSVSource`)
- [x] 4. Polish triage & folders for touch, plus the "Set status" menu and consistent date display
- [x] 5. PWA finish (icons, manifest, offline) + Vercel deploy (statement-swipe.vercel.app) + CI and
  branch protection on `main` + installed and tested on Eli's iPhone. The real-CSV part was blocked:
  Eli's bank app only offers PDFs on the phone (see PDF import in Phase 6).
- [x] 5.5. Feel and motion, from Eli's phone test: smoother swipes and screen transitions, pressed
  states, overscroll bounce, larger text that follows the phone's text size, clearer header buttons,
  confirm before replacing a review (see `docs/ideas.md`). Motion helpers: `src/lib/motion.ts`,
  `src/hooks/useAnimate.ts`; bottom sheets share `src/components/Sheet.tsx`
- [x] 6. Split into three parts, each with its own branch, PR, and phone test (see `docs/ideas.md`):
  - [x] 6a. **On-device PDF statements** (`PDFSource`, `src/lib/statementPdf.ts`), tuned on Eli's
    Bank of America PDF via the masked-layout script (totals match to the cent), phone-tested on Eli's
    iPhone. Also added: Playwright WebKit e2e tests on CI, iPhone-simulator testing, `npm run preview`
    with the live CSP, "Show all/Show fewer" in the import preview, no "—" category chip
  - [x] 6b. **Multiple statements:** Dexie storage (the old saved review migrates automatically),
    Statements home screen (filters, ⋯ menu to rename/archive/delete, breakdown bars via
    `ledgerSegments`), smart default names ("July 2026"), light Settings (suggest past folder names,
    About & privacy, Erase everything), phone-tested by Eli. No tab bar yet (arrives with Tasks)
  - [x] 6c. **Tasks** (`TasksScreen`, `src/lib/tasks.ts`): a floating dark-green tab bar (Statements,
    Tasks), tasks grouped by status with possible fraud first, resolving flagged purchases with the same
    statuses as folders, and "Remind me after" (default 2 weeks) for Overdue tags plus a count on the
    Tasks tab. Pages that slide over a screen (Look closer, a folder opened from Tasks) share `SlideOver`.
    Phone-tested by Eli over three rounds. Remembered bank setups and OFX/QFX files moved to Phase 7
- [ ] 7. Split into three parts, each with its own branch, PR, and phone test (see `docs/ideas.md`):
  - [x] 7a. **Dark mode** (System · Light · Dark in Settings, `src/lib/theme.ts`, `public/theme.js`),
    phone-tested and approved by Eli; a swipe tick on Android (`src/lib/haptics.ts`) and "Share to
    Statement Swipe" on Android (`src/lib/shareTarget.ts`, `public/share-target.js`). Android testing
    postponed by Eli: both Android features are covered by automated tests only until checked on Android
  - [ ] 7b. ← **next.** The onboarding tour: an interactive walkthrough on a sandboxed sample statement, replayable
    from Settings; the standalone "Try the sample statement" button goes away; per-bank download guides
  - [ ] 7c. Remembered bank setups and OFX/QFX files
- [ ] 8. On-device smarts: familiar/new merchant tags, merchant-code decoder, web-search link,
  calendar reminders (see `docs/ideas.md`)
- [ ] 9. App Store version with Capacitor (**ask Eli again before starting**), then accounts/backend + Stripe, then opt-in bank connection (Teller → Plaid) through a relay-only
  server that never stores transactions, then enrichment; push notifications; optional AI merchant
  explanation (see `docs/ideas.md`). Install the Vercel Claude Code plugin at the start of this phase.
- [ ] 10. Security & compliance hardening (with real legal counsel)

## Gotchas

- The Claude desktop app's built-in browser pane may or may not register the service worker; when it
  does, it keeps serving the old build after a rebuild (unregister it and clear caches from the page, then
  reload). While the pane is hidden its animation clock is frozen, so measure motion in Playwright
  WebKit instead. Verify offline/install behavior in real Chrome or on the phone.
- The Content-Security-Policy in `vercel.json` blocks all requests to other servers. `npm run preview`
  (and so the e2e tests) sends the same headers, read from `vercel.json`; `npm run dev` doesn't.
- **iPhone Safari lags desktop engines**, even Playwright's WebKit. Example: iOS 26 Safari can't
  `for await` over a `ReadableStream`, which broke pdfjs's `getTextContent` (we read the stream by hand
  in `pdfSource.ts`). Before a phone test, try new browser-facing code in the iPhone simulator's Safari
  (Xcode's iOS 26.5 runtime is installed): serve `npm run preview` and open it with the simulator tool.
- The prototype has setState-inside-useEffect patterns (flagged by oxlint when it scanned `docs/`).
  Don't copy them; derive values during render or set state from the triggering event.
- Bank CSVs vary: column names/order, sign conventions (purchases negative vs positive, or split
  debit/credit columns), and preamble rows above the header.
- Cryptic merchant names (`SQ *DD BAR`) can't be decoded from CSV. Don't fake enrichment.
- PDF statements are now in scope (Phase 6a, on-device), reversing `docs/handoff.md` §12. The PDF reader's
  worker is an `.mjs` file; `vite.config.ts` precaches `mjs` so PDF import works offline.
- PDF import can't be tested in jsdom (the reader needs a worker). Reader tests run in Vitest's Node
  environment (`// @vitest-environment node`); screen tests stub `PDFSource.fromData`; `e2e/` runs the
  real thing in WebKit, and `e2e/private-statement.spec.ts` tries PDFs in `private/` (counts only).
- Out of scope for now: custom per-folder statuses. Native apps wait for the
  App Store step at the start of Phase 9 (via Capacitor, not a rewrite; ask Eli first).
