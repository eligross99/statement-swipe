# Statement Swipe

A mobile-first PWA for reviewing a credit-card statement one card at a time, dating-app style:
**right = recognized**, **left = investigate**, **up = file into a folder**. After the review, users
triage folders (split with friends, reimburse, taxes) with a status and a note per purchase.
Local-first: **the user's statement never leaves their device.**

- Full product and engineering brief: `docs/handoff.md`. Read the relevant section before starting a phase.
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
- **This GitHub repo is public.** Never commit real statements or personal financial data.
  `.gitignore` blocks `*.csv`/`*.ofx`/`*.qfx`/`*.pdf`. Test data must be synthetic and live in `tests/fixtures/`.

## Design

**This supersedes the dark "ink deck" design in `docs/handoff.md` §9.** Eli chose a white-and-green
direction: calm, clear, efficient, and signaling financial well-being.

- All colors live in `src/styles/tokens.css` as CSS custom properties. Never hard-code hex values in components.
- White cards on a near-white, faintly green background (`--bg`). One deep "money green" brand color (`--brand`).
  Generous whitespace; soft shadows; no heavy borders.
- Action colors are functional and consistent everywhere (each has a `-tint` for soft fills):
  approve = brand green, investigate = amber, pile = indigo, fraud = red, waiting = blue.
  Approve is the only solid-filled action (the "healthy default"); others use tint backgrounds.
- Amounts are the largest element on a card and use tabular figures (`.num` class), in the system sans font.
- Keep the signature feel: tilt on drag, fading directional stamps, 1–2 peek cards behind the top card.
- Mobile-first (~400px). Touch targets ≥ 44px. Every gesture has a button and arrow-key fallback, plus undo.

## Workflow

- One roadmap phase per branch (`phase-1-scaffold`, `phase-2-port`, …), merged to `main` via a PR.
- Small commits with clear messages. Before each commit: `npm run build`, `npm test`, and `npm run lint` pass.
- Verify UI changes by running the app in the browser at phone width, not just by reading code.
- At the end of each phase, update the Roadmap status below, then start a fresh Claude session.

## Roadmap status

See `docs/handoff.md` §11 for details.

- [x] 1. Scaffold Vite + React + TS PWA with the stack above
- [x] 2. Port prototype; replace `window.storage` with IndexedDB
- [ ] 3. Harden CSV import (header-row detection, `TransactionSource`/`CSVSource`)  ← **next**
- [ ] 4. Polish triage & folders for touch
- [ ] 5. PWA finish (icons, manifest, offline) + Vercel deploy + on-phone test with a real CSV
  - Also set up CI: a GitHub Actions workflow that runs `npm run build`, `npm test`, and
    `npm run lint` on every PR, so PRs can't be merged if they fail. Eli hasn't used CI or GitHub
    Actions before: explain what it is and walk them through any GitHub settings step by step.
- [ ] 6. Accounts/backend + Stripe, then bank sync (Teller → Plaid), then enrichment
- [ ] 7. Security & compliance hardening (with real legal counsel)

## Gotchas

- The Claude desktop app's built-in browser can't register service workers. Verify offline/install
  behavior in real Chrome or on the phone, not the preview pane.
- The prototype has setState-inside-useEffect patterns (flagged by oxlint when it scanned `docs/`).
  Don't copy them; derive values during render or set state from the triggering event.
- Bank CSVs vary: column names/order, sign conventions (purchases negative vs positive, or split
  debit/credit columns), and preamble rows above the header.
- Cryptic merchant names (`SQ *DD BAR`) can't be decoded from CSV. Don't fake enrichment.
- Out of scope for now: PDF statements, statement history, custom per-folder statuses, native apps.
