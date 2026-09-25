/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/** The live site's security headers (vercel.json), so `npm run preview` behaves like Vercel. */
const vercelHeaders: { key: string; value: string }[] = JSON.parse(readFileSync('vercel.json', 'utf8')).headers[0].headers

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // New versions install silently in the background and apply on next load.
      registerType: 'autoUpdate',
      // Precache the whole app shell so it works fully offline, including the PDF reader
      // (its worker is an .mjs file, about 1.3 MB, under Workbox's 2 MB per-file limit).
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,webmanifest}'],
        // Receives statements shared to the installed app on Android (see share_target below).
        importScripts: ['share-target.js'],
      },
      // Files in public/ that aren't referenced by the built app but should still work offline.
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Statement Swipe',
        short_name: 'Swipe',
        description: 'Review your credit-card statement one swipe at a time.',
        theme_color: '#f4f7f5', // matches --bg in tokens.css so the status bar blends in
        background_color: '#f4f7f5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['finance', 'productivity'],
        // Android lists the installed app in the Share menu for these files. The file goes to the
        // service worker (public/share-target.js), never to a server. See src/lib/shareTarget.ts.
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [
              {
                name: 'statement',
                accept: ['application/pdf', '.pdf', 'text/csv', 'text/comma-separated-values', '.csv'],
              },
            ],
          },
        },
        // PNGs are generated from the SVGs by scripts/make-icons.sh.
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  preview: {
    headers: Object.fromEntries(vercelHeaders.map((h) => [h.key, h.value])),
  },
  test: {
    // e2e/ holds Playwright tests, which run in real browsers via `npm run test:e2e`.
    exclude: ['e2e/**', 'node_modules/**'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
