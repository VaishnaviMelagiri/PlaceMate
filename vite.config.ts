import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  // Port 5173 is taken by the RAG project's Docker container (rag-frontend),
  // which also publishes IPv6 [::]:5173 — browsers hit that first and show the
  // wrong app. Pin PlaceMate to its own port to avoid the collision entirely.
  server: { port: 5180, strictPort: true },
  preview: { port: 5180, strictPort: true },
  plugins: [
    react(),
    VitePWA({
      // Custom service worker (src/sw.ts) so we can add push + notificationclick
      // handlers. Workbox still injects the precache manifest into it.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'PlaceMate — Placement Tracker',
        short_name: 'PlaceMate',
        description:
          'Track placement applications, get prep help, and never miss a deadline.',
        theme_color: '#4f46e5',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      injectManifest: {
        // Precache ONLY the static app shell (built JS/CSS/HTML/icons). The SW
        // defines NO runtime caching for Supabase, so auth/API calls (a different
        // origin) always hit the network and are never served stale from cache.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      devOptions: {
        // Allow testing the service worker in `vite dev` when needed.
        enabled: false,
        type: 'module',
      },
    }),
  ],
})
