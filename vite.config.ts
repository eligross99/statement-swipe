/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // New versions install silently in the background and apply on next load.
      registerType: 'autoUpdate',
      // Precache the whole app shell so it works fully offline.
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'] },
      manifest: {
        name: 'Statement Swipe',
        short_name: 'Swipe',
        description: 'Review your credit-card statement one swipe at a time.',
        theme_color: '#ffffff',
        background_color: '#f4f7f5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        // Placeholder icon; proper PNG icon set comes in Phase 5.
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
