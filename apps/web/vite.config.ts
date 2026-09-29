import { fileURLToPath, URL } from 'node:url'
import basicSsl from '@vitejs/plugin-basic-ssl'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    // `pnpm dev:https` sirve con certificado autofirmado: la cámara del celular exige HTTPS.
    ...(mode === 'https' ? [basicSsl()] : []),
    // Solo en el build: en desarrollo no hay service worker (evita cachés viejas al programar).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Rendi',
        short_name: 'Rendi',
        description: 'Despensa, lista de compras y vencimientos del hogar',
        lang: 'es-CL',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f7f7f5',
        theme_color: '#2f7d4f',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // El WASM del escáner (~1 MB) también se guarda: debe funcionar sin internet.
        globPatterns: ['**/*.{js,css,html,svg,png,wasm}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Respuestas de la API para abrir la lista de compras sin conexión (con la sesión y los
            // datos de referencia que usa la página). Red primero: la copia solo se usa sin red o si
            // tarda. Se borran al cerrar sesión (`clearCachedData`). Debe ser un literal: se copia
            // tal cual al service worker.
            urlPattern:
              /\/api\/(auth\/me|shopping\/(items|supermarkets)|catalog\/categories)(\?|$)/,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'rendi-api',
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true,
    port: Number(process.env.WEB_PORT ?? 5173),
    strictPort: true,
    proxy: {
      // Configurable para que las pruebas e2e usen su propia API sin chocar con `pnpm dev`.
      '/api': process.env.API_URL ?? 'http://127.0.0.1:3000',
    },
  },
}))
