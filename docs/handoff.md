# Statement Swipe — Engineering Handoff & Build Guide

A complete pick-up-cold brief for building the deployable version. Assumes no prior context. The companion file `StatementSwipe.jsx` is a **working reference prototype** — it is the source of truth for the UI and interaction logic. This document explains the *why*, the *what*, and the *how to build it for real*.

---

## 1. What this is (one paragraph)

Statement Swipe is a mobile-first app for reviewing your monthly credit-card statement the way you swipe a dating app: each purchase comes up as a card, one at a time, and you clear it with a gesture — right to approve a purchase you recognize, left to investigate one you don't, up to file it into a folder for follow-up. When you finish, you get a clean summary and can open each folder to triage what to do next (e.g., collect Venmo from friends, flag a reimbursement, set aside for taxes). It runs locally in the browser; the user's statement never leaves their device.

---

## 2. The driver — why it exists

The core user pain: paying your credit-card bill means reading the statement line by line to make sure nothing is fraudulent, which is tedious, boring, and time-consuming — so people either skip it (and miss fraud) or set autopay (and stop reviewing). The insight is that the review is really a fast triage task, and a swipe interface makes triage fast and even satisfying. The second insight — and the more differentiated one — is that reviewing a purchase often surfaces a *next action* ("this dinner needs to be split," "this is reimbursable," "this is a tax write-off"), and no tool helps you capture and act on those. Statement Swipe treats "review, then act" as the whole product.

---

## 3. Positioning — read this before building, it shapes priorities

The swipe-to-review mechanic is **not novel** — Monarch Money ("Swipe to Review") and Origin ("Review Transactions") already ship it inside full budgeting suites. So the swipe alone is table stakes. Statement Swipe's differentiation, and where engineering/UX effort should concentrate, is:

- **Fraud-review-first framing** — for people who don't want to adopt a whole budgeting app, they just want to safely check and pay their card.
- **Actionable folders ("piles")** — the "review, then take the next step on specific purchases" workflow (split, reimburse, tax, follow-up). This is the wedge. Budgeting apps categorize for insight; nobody owns "act on these specific purchases."
- **Local-first / privacy** — "your statement never leaves your device" is a genuine trust advantage over sync-everything incumbents. Protect it.

Do not build this to compete with Monarch/Copilot/YNAB on their terms (net worth, forecasting, investment tracking). Stay the sharp, standalone, do-one-thing-well tool.

**Target user:** someone who wants to review before paying — fraud-conscious card users, people who float shared expenses (roommates, friend groups, couples), freelancers/consultants tracking reimbursables and deductions.

---

## 4. Core interaction model (recreate this precisely)

Three top-level gestures on the card deck. The design principle: keep the swipe layer to three unambiguous actions and push all complexity into deliberate screens.

| Gesture | Meaning | Behavior |
|---|---|---|
| **Swipe right** | Recognized & approved | Card animates off right, advances. `status: approved` |
| **Swipe up** | File into a folder | Opens the folder sheet; picking/creating a folder files it and advances. `status: piled` |
| **Swipe left** | Don't recognize / look closer | Opens the **investigation view** — does NOT dismiss the card |

- **Investigation view** shows the transaction's full statement fields, then two actions: "I recognize it — approve" (`approved`) or "Flag as possible fraud" (`flagged`). "Back" leaves the card unresolved in the deck.
- **Feedback while dragging:** the card tilts proportionally to horizontal drag, and a directional stamp fades in (green "RECOGNIZED" right, amber "LOOK CLOSER" left, indigo "PILE" up). The next 1–2 cards peek behind the top card for a physical-deck feel. This tactile feedback is the signature moment — keep it.
- **Fallbacks:** on-screen buttons for all three actions and arrow-key shortcuts (right/left/up), plus undo-last-action. These matter for testability and accessibility.
- **Card states:** `unreviewed → approved | piled | flagged`. Every card must reach a terminal state before the session completes (this is the point — completeness is the fraud-review value).

### Folders ("piles")
- **Session-scoped and start empty.** A session begins when the user imports data and starts swiping. No folders exist until the user creates one — because each statement needs different folders (this month a ski trip, next month not).
- **Created on demand at the moment of filing.** Up-swipe opens a sheet; naming a new folder files the current purchase into it in one action. Existing folders appear as tappable rows.
- **Deletable.** Empty folders delete instantly; a folder with items asks for inline confirmation, and on delete its items **revert to `approved` (pileId cleared)** — deletion must never destroy review state.

### Post-review: summary + triage (the differentiated part)
- **Summary** shows: a reconciliation line (reviewed N of N, $X of $Y), counts (approved / filed / flagged), a fraud-flag list, and each folder as a **card showing name, item count, and subtotal only** (not the individual purchases) with an "N to act on" hint.
- **Folder detail** (tap a folder card): lists that folder's transactions in one view, with folder-level totals ("still to act on" = sum of not-done items; "done" count). Each transaction gets a **triage layer**:
  - a **next-step status** (To do / Waiting / Done) set by tapping a pill, and
  - a **free-text note** ("ask the ski group to Venmo their share").
  - The "still to act on" total excludes items marked Done, so it drops to $0 as the user settles up.

---

## 5. Screen flow

```
Import ──▶ Deck ──▶ Summary ──▶ Folder detail
              │         ▲            (triage: status + notes)
   left ▶ Investigation │
   up   ▶ Folder sheet ─┘
```

Screens: **Import** (CSV pick/drop, column mapping, preview, start; sample-data option) · **Deck** (swipe cards + progress) · **Investigation** (overlay) · **Folder sheet** (create/file/delete) · **Summary** · **Folder detail** (triage).

---

## 6. Key features (checklist)

1. CSV statement import with auto-detected, user-correctable column mapping (description / amount / date) and a "purchases are negative" toggle; payments/credits auto-filtered.
2. Live import preview with running count + total before starting.
3. Three-gesture swipe deck with tilt, directional stamps, peek cards, button + keyboard fallbacks, undo.
4. Investigation view with approve / flag-fraud branch.
5. Session-scoped folders: create-and-file on up-swipe, tap-to-file, safe delete.
6. Summary: reconciliation, status counts, fraud list, folder cards.
7. Folder triage: per-transaction next-step status + notes, folder-level "still to act on" total.
8. Session persistence (survives reload / tab switch).

---

## 7. Data model

```ts
type Status = "unreviewed" | "approved" | "piled" | "flagged";
type Action = null | "todo" | "waiting" | "done";   // next-step triage

interface Transaction {
  id: string;
  desc: string;        // raw statement descriptor (often cryptic)
  amount: number;      // absolute value
  date: string;
  cat: string;         // category if present, else "—"
  status: Status;
  pileId: string | null;
  action: Action;
  note: string;
  sus?: boolean;       // heuristic "looks unusual" flag (demo)
  loc?: string | null; // location if known
  // Future (bank-sync era): merchantName, merchantLogo, location, pending
}

interface Pile { id: string; name: string; }        // session-scoped

interface Session {                                  // the persisted blob
  txns: Transaction[]; index: number; piles: Pile[];
  screen: string; label: string; openPile: string | null;
}
```

---

## 8. Architecture

### Frontend
React + Vite, built as an installable, offline-capable **PWA** (via vite-plugin-pwa). Mobile-first; the reference prototype renders inside a phone-frame at ~400px max width. Single-page with screen state (`import | deck | summary | pile`) + overlays.

### Persistence (critical port note)
The prototype persists the session blob via `window.storage`, which **only exists in the Claude artifact runtime and will not exist in the real app.** Replace it with **IndexedDB** — `idb-keyval` for a single session blob to start, or **Dexie** if/when you keep a history of past statements. Save debounced on change, restore on mount. Missing this reintroduces the data-loss-on-reload bug the prototype already solved.

### Data source abstraction (build this seam now)
Wrap all transaction ingestion behind a `TransactionSource` interface that outputs a normalized `Transaction[]`:
```
TransactionSource
 ├─ CSVSource     // v1 — parse + column mapping + sign handling
 ├─ TellerSource  // later — indie-friendly bank sync
 └─ PlaidSource   // later — scale bank sync + merchant enrichment
```
Everything downstream (deck, folders, triage, summary) only ever sees normalized transactions and never knows the source. This is what lets you go from CSV to bank sync without a rewrite.

### Analytics (privacy is non-negotiable)
If you add product analytics (e.g., PostHog/Plausible) to measure activation and retention, instrument **anonymous usage events only** — `session_started`, `review_completed`, `folder_created`, etc. **Never** send transaction text, amounts, merchant names, or notes. The privacy promise is core to the positioning; don't undermine it through a side channel.

### Path to "deployable multi-user" (Stage 2+)
The local-first CSV app is the foundation. To make it a real product:
- **Bank sync** via an aggregator behind the `TransactionSource` seam — start on **Teller** (indie-friendly, ~100 free live connections), add **Plaid** (~$0.30–$1+/successful link) at scale. This removes the manual-CSV friction that caps retention, and enables real merchant enrichment (turning `SQ*DD BAR` into a real name/logo/location in the investigation view).
- **Accounts + backend** — auth + a database so sessions sync across devices and support paid tiers. Prefer keeping raw statement data encrypted / minimizing what's stored server-side to preserve the privacy posture.
- **Payments** — Stripe subscriptions; likely freemium (free CSV tier → paid unlocks bank sync, unlimited folders, statement history). Keep per-user aggregator cost well under the subscription price.
- **Compliance** — handling financial data at scale brings privacy-law and security obligations. **Get real legal/compliance advice; do not wing this.**

---

## 9. Design language (so it can be recreated faithfully)

The cards are the hero — physical paper stock on a deep ink deck.

- **Palette:** ink background `#101119` / `#191B26` / `#20222F`; paper card `#FBFAF6` with edge `#EAE7DC`; semantic action colors — approve green `#12A150`, investigate amber `#E0872B`, pile indigo `#6D5CE7`, fraud red `#E5484D`, waiting blue `#3B82F6`; muted text `#7A7C88`, hairline `#2A2C39`.
- **Typography:** monospaced tabular figures for amounts (receipt/finance feel), a clean sans for merchant names. Amount is the largest element on each card.
- **Signature:** paper cards on the ink deck; directional color stamps + tilt on drag; peek cards behind the top card.
- **Feedback colors are functional, not decorative** — the three gesture colors map to the three actions and carry through to the summary and triage. Keep them consistent everywhere.

---

## 10. Tech stack

- React + Vite — https://vitejs.dev
- vite-plugin-pwa — https://vite-pwa-org.netlify.app
- idb-keyval (or Dexie for history) — https://github.com/jakearchibald/idb-keyval · https://dexie.org
- papaparse (CSV) — https://www.papaparse.com
- lucide-react (icons) — https://lucide.dev
- Later: Teller — https://teller.io · Plaid — https://plaid.com · Stripe — https://stripe.com · PostHog — https://posthog.com

---

## 11. Build roadmap (phased; commit + device-test each)

1. **Scaffold** the Vite React PWA (installable, offline) with the stack above.
2. **Port the prototype** as the main app; replace `window.storage` with IndexedDB.
3. **Harden CSV import** — add header-row detection (some exports have preamble rows above the header), keep column mapping + sign toggle, and formalize the `TransactionSource` / `CSVSource` interface.
4. **Polish triage & folders** for touch (comfortable status pill + note editor, empty/single-item states).
5. **PWA finish** — icon, name, theme color, standalone display, offline fallback; install + test a real statement CSV on-device.
6. **(Deployable) Accounts + backend + Stripe**, then **bank sync via Teller/Plaid** behind the source seam, then **enrichment** in the investigation view.
7. **(Deployable) Security + compliance** hardening with real legal counsel.

---

## 12. Known constraints & gotchas

- `window.storage` in the prototype = artifact-runtime only → must become IndexedDB.
- CSV realities: bank exports differ in column names/order; amount sign conventions vary (negative vs positive for purchases; sometimes split debit/credit columns); some files have preamble rows before the header. The mapping UI + sign toggle + header detection cover these.
- Cryptic merchant descriptors (`SQ*DD BAR`, `AMZN MKTP US*…`) can't be de-crypted from CSV alone — real enrichment needs an aggregator. The investigation view is honest about showing only statement-level fields until then.
- PDF statements are out of scope until bank sync — reliable on-device PDF parsing isn't worth building.
- Triage statuses (To do / Waiting / Done) are one universal set for now; per-folder custom vocabularies (Ordered/Delivered vs Requested/Paid) are a later option — the free-text note absorbs specifics in the meantime.

---

## 13. Out of scope for the first deployable / future ideas

Multi-statement history and cross-month trends; recurring-charge / subscription surfacing; export a folder (e.g., the Venmo list) as a shareable request for a group chat; per-folder custom statuses; merchant enrichment; Android/native wrappers (React Native reuses this logic if App Store distribution is ever wanted).
