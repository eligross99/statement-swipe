// End-to-end tests: the real production build in real browser engines. WebKit is the engine behind
// every iPhone browser, so it catches Safari-only problems that Vitest (jsdom) and Chrome can't.
// Run `npm run build` first, then `npm run test:e2e`.
import { defineConfig, devices } from '@playwright/test'

const PORT = 4176

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  // CI's machines are slower than ours: a test that fails there gets one more try, recorded as a trace
  // (a step-by-step replay with page snapshots) and saved by the CI workflow. A test that only passes on
  // its retry is still reported as flaky, so timing problems stay visible.
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}`, trace: 'on-first-retry' },
  projects: [{ name: 'iPhone Safari (WebKit)', use: { ...devices['iPhone 15'] } }],
  // The preview server sends the same Content-Security-Policy as Vercel (see vite.config.ts).
  webServer: { command: `npm run preview -- --port ${PORT} --strictPort`, port: PORT, reuseExistingServer: !process.env.CI },
})
