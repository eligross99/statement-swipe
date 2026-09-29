# Design notes

The design techniques this app uses, why we chose them, and where they live in the code. The rules in
`CLAUDE.md` ("Design") say *what* the app must look like; this file records *how* we got there, mostly
from Eli's phone tests, so every screen keeps the same polish.

**Keep it current:** whenever a UI change introduces or changes a technique, add or update its entry
here in the same commit. Say what it is, why (quote the feedback that led to it), and where it lives.
Read this before designing a new screen.

## Color and surfaces

- **Tokens only.** Every color is a CSS variable in `src/styles/tokens.css`; components never use hex.
  Colors that must be see-through (glass, shadows) are tokens too (`--dock`, `--shadow-float`).
- **Anything on the page background needs a visible container, or no box at all.** `--surface-sunken`
  is almost the same color as `--bg`, so a grey box on the page looks like text that's slightly indented
  (Look closer's info text, 6c). Grey boxes (notes, tracks) only go *inside* white cards; on the page,
  use plain text lined up with everything else, or a white card.
- **Notes always look like notes:** a grey note box inside a white card (`.task-note`,
  `.task-note-preview`), never plain grey text, which reads as metadata (6c).
- **Floating controls are dark glass.** The tab bar is a dark, deep-green frosted capsule
  (`--dock`, `backdrop-filter: blur() saturate()`, a light hairline on top via `--dock-edge`, a layered
  `--shadow-float`). A light frosted bar blended into the white cards scrolling under it: blurred
  white is still white (6c).
- **Two themes, one set of names (7a).** Every color token has a light value (`:root`) and a dark value
  (`:root[data-theme='dark']`) in `tokens.css`; components never know which theme is showing. Settings
  offers System, Light, and Dark. `public/theme.js` applies the saved choice before the first paint (no
  white flash for Dark), and `useTheme` follows the phone live while the choice is System.
- **Dark is deep green-black, never pure black,** so the app stays calm and green. Each layer is a step
  lighter than the one below it (page `#0b1410`, cards, then boxes inside cards), because shadows barely
  show on dark. Hairline borders keep cards apart.
- **Action colors get brighter in dark,** and Approve turns bright mint with dark text: white text on a
  bright green isn't readable enough. `src/styles/tokens.test.ts` checks every text-on-background pair
  is at least 4.5:1 in both themes, so a new color can't quietly become unreadable.
- **The tab bar looks the same in both themes:** a dark green glass capsule with a mint pill. In dark it
  is lifted a step lighter (`--dock`) so it still floats off the page. Its pill and badge ring have their
  own tokens (`--dock-pill`, `--dock-ring`) so they don't change with the page.
- **Switch knobs stay white** in both themes, like the phone's own switches (`--toggle-knob`); the off
  track has its own token (`--toggle-off`) because the border color disappears on a dark card.
- **Floating buttons** (the Statements import button) get `--shadow-float` and no background band
  behind them, so the list visibly scrolls underneath (6c).

## Controls

- **One "selected" look everywhere: a mint pill** (`--brand-tint` fill, `--brand-strong` text) that
  *slides* to the chosen option. Used by the tab bar (`TabBar.css`, `.tab-indicator`) and the Statements
  filters (`.st-filter-pill`). The pill is one absolutely positioned element moved with `translateX`,
  so it travels instead of blinking; 560ms, `cubic-bezier(0.3, 0.7, 0.2, 1)` (380ms was "too fast").
  Filters and Settings' Appearance share one component, `Segmented`, so every choice row looks alike.
- **Segmented controls sit on a white track** with a border and `--shadow-card` (a grey track on the
  grey page was "barely noticeable", 6c).
- **Compact over stretched.** The tab bar is a fixed-width (264px) centered capsule; edge to edge felt
  "longer than it needs to be" (6c).
- **Whole-card taps.** A tappable card opens from a tap anywhere on it: its open button stretches over
  the card with `::after { position: absolute; inset: 0 }`, and the card presses in via
  `.card:has(.open:active)`. Other buttons inside (the status pill) sit above it with
  `position: relative; z-index: 1`; their row gets `pointer-events: none` and only the button
  `pointer-events: auto`, so empty space still opens the card (`TasksScreen.css`, 6c).
- **Every tap shows feedback:** buttons scale to 0.97 and dim instantly on press and ease back on
  release (`index.css`); task cards and statement rows scale to 0.98 (statement rows also tint grey).
- **Status pills** (To do amber, Waiting blue, Done green) are one component, `StatusPill` in
  `TaskControls.tsx`, reused by folders, Tasks, and Look closer. Same data, same look on every screen.
- **Only offer what the device can do.** "Vibrate when a swipe lands" appears in Settings only on touch
  phones whose browser can vibrate (Android); iPhone browsers can't, so there it would be a switch that
  does nothing (`canVibrate` in `src/lib/haptics.ts`). The tick is 12ms, on real swipes only, not taps.
- **Teach one thing at a time, in order, through the real app (7b).** Eli's rule: the tour mimics how
  the app is really used (reach Tasks with back, back, then the Tasks tab; import from Statements), with
  no shortcuts. Each instruction lists the only controls that respond (`allow` in `src/lib/tour.ts`,
  matched by `data-tour` attributes); every other tap is stopped before the app sees it, and the tour
  card lights up and points again (`TourCoach.tsx`). Controls stay looking normal, except the ones that
  compete with the step, which go pale like the deck's buttons: Approve in Look closer, the other
  statuses. The deck accepts only the swipe being taught (`only` in `Deck.tsx`).
- **Point at what to tap (7b).** The tap guide is a soft glow around the control (its own rounded
  corners, or its card's) plus the swipe hint's touch dot pressing it, every 2.4s. It follows the control,
  hides while something covers it, and scrolls it into full view if it's cut off, once per instruction
  (doing it again yanked the page back while Eli scrolled Look closer). Drawn in the Approve color, which
  stays bright in dark mode, with a thin page-colored outline between it and the control, so it still
  shows on green (on the green Import button it "blended in", Eli). With Reduce Motion the glow stays
  still and the dot is hidden.
- **Guard taps, never touches.** The tour stops only taps (clicks) outside the step. A finger going down
  also starts every scroll, so reacting to it treated scrolling as a wrong tap (`TourCoach.tsx`).
- **Expandable rows grow and fold at the same pace (7b).** The bank guides open one at a time: the row's
  body animates `grid-template-rows` from `0fr` to `1fr` over 400ms with a fade, and the chevron turns.
  Closed bodies stay in the page but are `inert`, so they can't be reached until opened (`GuidePage.css`).
- **Links that look like buttons act like buttons (7c).** "Search the web" and "Send feedback" are links
  (`<a class="btn">`, so the phone opens the browser or mail app) with the same press-in as buttons
  (`a.btn:active` in `index.css`) and no underline.
- **Say exactly what leaves the device, right where it happens (7c).** "Search the web" has a quiet line
  under it naming the words Google gets ("Opens Google with just “DD BAR”, nothing else."), and "Help fix
  this for your bank" shows the full masked text in a scrolling grey box before Share (`LayoutSheet`).
- **Touch targets are at least 44px** (`--tap-min`); badges and other fixed-size bits cap their text with
  `min()` so large text settings can't break them.

## Layout and navigation

- **Pages opened from a list slide over it** rather than replacing the screen: `SlideOver` (used by Look
  closer and by a folder opened from Tasks). The screen underneath stays put, keeping its scroll
  position, and Back slides the page away to the right. Swapping screens for this felt "off" (6c).
- **Back is always reachable, and floats.** Screens keep their back button in the fixed header; slide-over
  pages pin theirs so it floats over the page as it scrolls, with no bar behind it (a page-colored bar cut
  text in half, Eli, 7b), and a soft fade under the status bar so text slips away before the clock
  (`.slide-over-top` in `SlideOver.css`).
- **Floating bars reserve space.** Screens under the tab bar pad their bottom by `--tabbar-space` (plus
  the import button's height on Statements), so the last row can scroll clear.
- **Urgent first.** Lists sort by urgency, then age: in Tasks, possible fraud with no status, then other
  possible fraud, then filed purchases with no status, then the rest (`urgency` in `src/lib/tasks.ts`).
  Group headings must never contradict a row's own label (a "To do" flag outside the To do section
  confused Eli, 6c).
- **Progress bars read done (left) to to-do (right),** and "nothing left to do" is one solid dark green.
  One function draws every breakdown bar (`ledgerSegments`), so the same data looks the same everywhere.
- **Instructions sit above everything, and everything moves down for them (7b).** The tour card is pinned
  to the top (z-index above sheets and slide-over pages) and writes its height into `--coach-space`; while
  it shows (`[data-coach]` on the page), the app, slide-over pages and sheets make room, so it never covers
  a button. **Its height never changes:** every line it can show is stacked invisibly in one grid cell,
  so the card is as tall as its longest line and the screen below never shifts between steps (Eli, 7b).
  On short phones the swipe card may shrink further so the action buttons stay on screen. Same dark green
  glass as the tab bar.
- **A card you can't move still answers your finger (7b, Eli's request).** Pulled up or down, the tour
  card follows with rubber-band resistance (and stretches a little when pulled down) and springs back
  with a small overshoot (460ms). Swiped right it goes back a step (there's also a ‹ button, faded on
  step 1 like Undo with nothing to undo); swiped left it stretches, lights up, and says to finish the step
  first. A tap presses it in like a task card and shows the tap guide again. Its step bars fill part way
  as each step's parts are done, so progress moves even while the step number doesn't.
- **Practice lives in a sandbox (7b).** The tour runs the real screens on a separate, never-saved library
  (`state.tour`), so the practice statement never appears in Statements or Tasks, and replaying the tour
  can't touch real statements. It keeps a copy from the start of each step, so going back is exact.
- **Suggestions are quiet cards that fold away for good (7c).** "Add Swipe to your Home Screen" is a white
  card at the top of Statements and Import with a tinted icon tile, one line of why, and two equal buttons
  (Not now, Show me how). Not now folds it away (height and fade, 320ms) and it never returns; the same
  steps stay in Settings, so dismissing loses nothing (`InstallHint.tsx`). It only appears where it
  applies (a phone that hasn't installed the app), never during the tour.
- **Only the logo while loading (7c, Eli: "like other professional apps").** The launch screen is the
  app icon alone, centered on the page color, drawn by `index.html` itself so it's there before any app
  code runs, in the right theme (`public/theme.js` has already run). It stays only as long as loading
  takes, never an added wait, then fades out over 450ms while the logo grows 8% (Reduce Motion: a quick
  fade only). Taps pass through it (`src/lib/splash.ts`, `#splash` in `index.css`).
- **Symmetry:** header buttons mirror each other (icon-only circles, a spacer when one side is empty),
  rows of buttons are evenly spaced, titles stay on one line.

## Motion

Shared values live in `src/lib/motion.ts` (`DURATION`, easings) and `src/hooks/useAnimate.ts`. Eli
consistently finds motion a little fast: start at the slow end.

- **React instantly, then let the result be seen.** Cards follow the finger 1:1; results ease over
  roughly 250 to 700ms. Screens never swap instantly.
- **Card fly-out 700ms** with a gentle start (`EASE_FLY`); undo fly-back 400ms; a 150ms pause after
  Look closer closes so the card is seen before it flies.
- **Things that leave smoothly come back smoothly.** A task moving groups folds away (height and fade)
  and then grows into its new place, both over 520ms (`DURATION.move`). The grow runs in a layout
  effect, so the row never flashes at full size first.
- **Show which way to swipe by doing it (7b, Eli's request).** On a tour step the top card leans about
  64px the way to swipe, its stamp peeking in at 75%, with a soft touch dot where a finger would push,
  then settles back: 1.7s per lean, the first after 0.9s, then every 4s. It stops the moment the card is
  touched and never plays with Reduce Motion, where the tour's words carry the instruction (`Deck.tsx`).
- **Highlight with color, not movement.** A purchase opened from Tasks glows indigo (`--pile-tint` fill,
  a soft `--pile-soft` outline) for about 1.3 seconds, then fades over about a second. The earlier
  scale "pulse" read as a glitch, and a deep outline was too much contrast (6c).
- **Scroll with `scrollTop`, not `scrollIntoView`,** while anything is sliding: `scrollIntoView` also
  scrolls sideways and nudged the whole app left mid-transition (`scrollToMiddle` in `FolderDetail.tsx`).
- **"Show all" and "Show fewer" animate the list's height** and fade the extra rows (`useShowMore`).
  Every list that expands can collapse again.
- **Respect Reduce Motion:** movement becomes a quick 150ms fade (`useAnimate`'s reduced keyframes,
  `index.css`), and sliding pills just jump. Color changes, like the highlight, still play.

## Words and text

- Sentence case, one name per action (Approve, Look closer, File, Flag as possible fraud), buttons say
  what happens, and empty states say what to do next (`CLAUDE.md` has the full list).
- **Careful fraud wording:** "possible fraud"; don't push people to dispute. Confirmations get gentler
  or firmer to match the situation (approving a flag marked To do or Waiting asks "Approve it anyway?").
- **No stranded words:** `text-wrap: pretty` on paragraphs and `balance` on short centered text,
  `white-space: nowrap` on button labels. Center short footer text instead of leaving balanced text
  lopsided in a wide box.
- **Quiet, not prominent,** for informational notes. Don't add shortcuts that repeat something already on
  screen (the "Pick up where you left off" banner was removed in 6b).
- **The tour speaks as a guide, briefly.** A short instruction ("Swipe right to approve") and one line of
  why, changing with what's on screen (Look closer open, the folder sheet open). Say what a feature is
  for in general, then the example (folders: "a bill to split, a reimbursement, taxes"). The tour's
  made-up folder name is labeled "Suggested", not "Names you've used before" (`guideFor` in
  `src/lib/tour.ts`). Its text wraps normally: Safari's "pretty" wrapping broke lines well short of the
  card's edge.
- **Steps name what's on the phone's screen, in bold, one action per line (7c).** The Home Screen steps
  were checked in the iOS 26 simulator and name its buttons exactly (Share, View More, Add to Home
  Screen, Open as Web App, Add), with an icon per step matching what that step says. Wording that fits
  more than one iOS version beats a per-version footnote (a long first step left "screen." alone on a line).
- **Don't show labels the app can't back up.** The sample's hand-set "Unusual" tag was removed (6c); a
  real, explained version comes with Phase 8's new-merchant tag.
