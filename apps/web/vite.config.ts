import { fileURLToPath, URL } from 'node:url'
import basicSsl from '@vitejs/plugin-basic-ssl'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  // `pnpm dev:https` sirve con certificado autofirmado: la cámara del celular exige HTTPS.
  plugins: [vue(), ...(mode === 'https' ? [basicSsl()] : [])],
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
