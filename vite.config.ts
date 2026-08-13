import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Usura',
        short_name: 'Usura',
        description: 'Gastos, recurrentes y deudas',
        lang: 'es-AR',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        // Carbón cálido: la barra del sistema tiene que ser del mismo material que la app.
        background_color: '#141210',
        theme_color: '#141210',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // La app entera se cachea: tiene que abrir sin señal.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // Nunca cachear la API: los datos los sirve Dexie, no el service worker.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // La cotización de un día pasado no cambia nunca.
            urlPattern: /^https:\/\/(dolarapi\.com|api\.argentinadatos\.com)\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'fx-rates',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: { host: true },
})
