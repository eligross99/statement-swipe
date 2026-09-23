# Deploying and testing on a phone

## How deploys work

- **Vercel** hosts the app. It watches the GitHub repo: every push to `main` deploys to the
  live site, and every PR gets its own preview link (posted as a comment on the PR).
- **CI** (`.github/workflows/ci.yml`) runs lint, build, and tests on every PR. Branch protection
  on `main` blocks merging until it passes.
- `vercel.json` sets the build command and the security headers below. There is no server code:
  Vercel only serves static files.

## Security headers (`vercel.json`)

- **Content-Security-Policy** tells the browser this app may only load code and make network
  requests to its own address (`'self'`). If a future change, or a bad dependency, tries to send
  data anywhere else, the browser blocks it. This is how we enforce "your statement never leaves
  this device" rather than just promising it. If you ever add an outside service on purpose, it
  must be added here, and that is a privacy decision to make deliberately.
- **Referrer-Policy: no-referrer**: when the user taps an outbound link (like the future "Search
  the web" link), the other site isn't told where they came from.
- **X-Content-Type-Options**, **Permissions-Policy**: standard hardening; the app never needs the
  camera, microphone, or location.
- `/sw.js` is never cached, so new versions reach users; hashed files in `/assets/` are cached forever.

## Icons

Source SVGs are `public/icon.svg` (rounded, for browsers) and `public/icon-maskable.svg`
(full-bleed, for Android home screens, which crop to their own shape) and `public/icon-apple.svg` (full-bleed with larger art, for iPhone, which only rounds the corners). After editing any of them, run
`sh scripts/make-icons.sh` (macOS) to regenerate the PNGs, and commit them.

## Phone test checklist

Do this on the live site (or a PR preview link) after anything that changes install or offline behavior.
The Claude desktop app's browser can't run service workers, so these checks must happen on a phone
or in real Chrome.

1. **Install.** iPhone: open the site in Safari, tap Share, then "Add to Home Screen".
   Android: open in Chrome, tap the menu, then "Install app" (or "Add to Home screen").
2. **Icon and launch.** The home-screen icon is the green card, and tapping it opens full-screen
   with no browser bar.
3. **Real statement.** Download a CSV from your card's website, open the app, and choose the file.
   Check the columns are detected, amounts have the right sign, and dates look right.
4. **Review.** Swipe through a few cards in each direction, undo once, and file one into a folder.
5. **Survives closing.** Swipe the app away from the app switcher, reopen it: you're where you left off.
6. **Offline.** Turn on airplane mode, close and reopen the app: it still opens and your review is there.
7. **Updates.** After the next deploy, open the app twice (the first open downloads the update
   in the background; the second uses it).

If anything looks wrong, note what you did, what you expected, and what happened. Never share the
CSV itself or a screenshot showing real transactions in a public place (like a GitHub issue).
