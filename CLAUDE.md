# Statement Swipe

A mobile-first PWA for reviewing a credit-card statement one card at a time, dating-app style:
**right = recognized**, **left = investigate**, **up = file into a folder**. After the review, users
triage folders (split with friends, reimburse, taxes) with a status and a note per purchase.
Local-first: **the user's statement never leaves their device.**

- Full product and engineering brief: `docs/handoff.md`. Read the relevant section before starting a phase.
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
- `idb-keyval`: IndexedDB persistence (switch to Dexie only if we add statement history)
- `papaparse`: CSV parsing · `lucide-react`: icons
- Vitest + Testing Library for unit/component tests; Playwright for end-to-end tests later
- Hosting: Vercel (auto-deploys from GitHub; set up in the PWA-finish phase)

## Commands

- `npm run dev`: local dev server
- `npm run build`: typecheck + production build
- `npm test`: unit tests (Vitest, once) · `npm run test:watch`: re-run on save
- `npm run typecheck`: TypeScript only
- `npm run preview`: serve the production build (the only mode where the PWA/service worker is active)
- `npm run lint`: lint (oxlint; `docs/` is excluded)
- `sh scripts/make-icons.sh`: regenerate the PNG app icons from the SVGs in `public/` (macOS)

Deploys, CI, security headers, and the phone test checklist: `docs/deploy.md`.

## Architecture rules

- **Data source seam:** all ingestion goes through a `TransactionSource` interface that returns a
  normalized `Transaction[]` (`CSVSource` now; Teller/Plaid later). Nothing downstream (deck,
  folders, summary, triage) may know where transactions came from.
- **Data model** lives in one types file and matches `docs/handoff.md` §7 (`Transaction`, `Pile`,
  `Session`, `Status`, `Action`).
- **Persistence:** save the whole `Session` blob to IndexedDB (debounced) and restore it on load.
  The prototype's `window.storage` only exists inside Claude artifacts and must not appear in this code.
- **Keep logic out of components:** CSV parsing, column detection, and state transitions (approve,
  pile, flag, undo, delete folder) are plain TypeScript functions with unit tests. Components render.
- **Invariants to preserve and test:**
  - Every transaction reaches a terminal state (`approved | piled | flagged`) before the session completes.
  - Swipe left opens the investigation view. It never dismisses the card.
  - Deleting a folder reverts its items to `approved` with `pileId: null`. Never lose review state.
  - Folders are session-scoped and start empty.
  - "Still to act on" = sum of a folder's items whose action is not `done`.

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

- All colors live in `src/styles/tokens.css` as CSS custom properties. Never hard-code hex values in components.
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
  `index.html` (`theme-color`), and the icon SVGs, which can't read CSS variables. Keep them in sync with `--bg`/`--brand`.

## Workflow

- One roadmap phase per branch (`phase-1-scaffold`, `phase-2-port`, …), merged to `main` via a PR.
- Small commits with clear messages. Before each commit: `npm run build`, `npm test`, and `npm run lint` pass.
- Verify UI changes by running the app in the browser at phone width, not just by reading code.
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
- [ ] 6. Multiple statements: Dexie storage (migrate the saved session), Statements screen, bottom
  navigation, Tasks dashboard, light Settings, rename statements + smart default names; easier import:
  **on-device PDF statements (priority)**, remembered bank setups, OFX/QFX files, Android "Share to"
  (see `docs/ideas.md`)  ← **next**
- [ ] 7. Dark mode (follows the phone, override in Settings) and Android haptics first; then the onboarding tour: an interactive walkthrough on a sandboxed sample statement, replayable from
  Settings; the standalone "Try the sample statement" button goes away; per-bank download guides
  (see `docs/ideas.md`)
- [ ] 8. On-device smarts: familiar/new merchant tags, merchant-code decoder, web-search link,
  calendar reminders (see `docs/ideas.md`)
- [ ] 9. App Store version with Capacitor (**ask Eli again before starting**), then accounts/backend + Stripe, then opt-in bank connection (Teller → Plaid) through a relay-only
  server that never stores transactions, then enrichment; push notifications; optional AI merchant
  explanation (see `docs/ideas.md`). Install the Vercel Claude Code plugin at the start of this phase.
- [ ] 10. Security & compliance hardening (with real legal counsel)

## Gotchas

- The Claude desktop app's built-in browser can't register service workers. Verify offline/install
  behavior in real Chrome or on the phone, not the preview pane.
- The Content-Security-Policy in `vercel.json` blocks all requests to other servers. It only applies
  on Vercel (not `npm run dev`/`preview`), so check a PR preview link after adding anything that loads
  from outside the app.
- The prototype has setState-inside-useEffect patterns (flagged by oxlint when it scanned `docs/`).
  Don't copy them; derive values during render or set state from the triggering event.
- Bank CSVs vary: column names/order, sign conventions (purchases negative vs positive, or split
  debit/credit columns), and preamble rows above the header.
- Cryptic merchant names (`SQ *DD BAR`) can't be decoded from CSV. Don't fake enrichment.
- PDF statements are now in scope (Phase 6, on-device), reversing `docs/handoff.md` §12.
- Out of scope for now: custom per-folder statuses. Native apps wait for the
  App Store step at the start of Phase 9 (via Capacitor, not a rewrite; ask Eli first).
