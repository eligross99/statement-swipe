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
  release (`index.css`); task cards scale to 0.98, statement rows tint grey.
- **Status pills** (To do amber, Waiting blue, Done green) are one component, `StatusPill` in
  `TaskControls.tsx`, reused by folders, Tasks, and Look closer. Same data, same look on every screen.
- **Only offer what the device can do.** "Vibrate when a swipe lands" appears in Settings only on touch
  phones whose browser can vibrate (Android); iPhone browsers can't, so there it would be a switch that
  does nothing (`canVibrate` in `src/lib/haptics.ts`). The tick is 12ms, on real swipes only, not taps.
- **Touch targets are at least 44px** (`--tap-min`); badges and other fixed-size bits cap their text with
  `min()` so large text settings can't break them.

## Layout and navigation

- **Pages opened from a list slide over it** rather than replacing the screen: `SlideOver` (used by Look
  closer and by a folder opened from Tasks). The screen underneath stays put, keeping its scroll
  position, and Back slides the page away to the right. Swapping screens for this felt "off" (6c).
- **Back is always reachable.** Screens keep their back button in the fixed header; slide-over pages pin
  theirs in a sticky bar with the page background behind it (`.slide-over-top`), bleeding to the edges
  and clearing the notch.
- **Floating bars reserve space.** Screens under the tab bar pad their bottom by `--tabbar-space` (plus
  the import button's height on Statements), so the last row can scroll clear.
- **Urgent first.** Lists sort by urgency, then age: in Tasks, possible fraud with no status, then other
  possible fraud, then filed purchases with no status, then the rest (`urgency` in `src/lib/tasks.ts`).
  Group headings must never contradict a row's own label (a "To do" flag outside the To do section
  confused Eli, 6c).
- **Progress bars read done (left) to to-do (right),** and "nothing left to do" is one solid dark green.
  One function draws every breakdown bar (`ledgerSegments`), so the same data looks the same everywhere.
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
- **Don't show labels the app can't back up.** The sample's hand-set "Unusual" tag was removed (6c); a
  real, explained version comes with Phase 8's new-merchant tag.
