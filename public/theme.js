// Applies the saved light/dark choice before the first paint, so someone who chose Dark never sees
// a white flash while the app loads. A plain script file (not inline) because the site's security
// policy only runs scripts from our own files. The React app takes over from here: see
// src/lib/theme.ts, which also keeps the saved copy below current. Keep the key and colors in sync.
;(function () {
  var choice = null
  try {
    choice = localStorage.getItem('statement-swipe-theme')
  } catch {
    // Storage can be off (e.g. some private-browsing modes): follow the phone instead.
  }
  var dark =
    choice === 'dark' ||
    (choice !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  // The status bar starts green, matching the launch screen (--launch in tokens.css). Once the app is
  // ready, applyTheme (src/lib/theme.ts) switches it to the page color as the launch screen fades.
  var meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', '#0a7d4f')
})()
