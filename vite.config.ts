import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { fileURLToPath } from 'node:url'

// Same shape as zenex-ui's config, trimmed to what an empty app needs.
// The node polyfills give @stellar/stellar-sdk the Buffer/process globals it expects in the browser.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ['process'],
      globals: { Buffer: true, process: true },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    dedupe: ['@stellar/stellar-sdk', '@stellar/stellar-base'],
  },
  optimizeDeps: {
    include: ['@stellar/stellar-sdk', 'buffer'],
    exclude: ['@zenith-protocols/zenex-sdk'],
    esbuildOptions: { define: { global: 'globalThis' } },
  },
  build: {
    commonjsOptions: { transformMixedEsModules: true },
  },
})
