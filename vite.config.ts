import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
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
        // Chrome en Android pide un PNG de 192 y otro de 512 para ofrecer instalar
        // la app; con SVG solo no siempre aparece el prompt. Se generan con
        // scripts/make-icons.ts desde el mismo dibujo que icon.svg.
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // La app entera se cachea: tiene que abrir sin señal.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
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
