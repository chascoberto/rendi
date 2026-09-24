import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/server.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  // El paquete compartido es solo código fuente: se incluye en el bundle.
  deps: { alwaysBundle: [/^@rendi\//] },
})
