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
  server: {
    // Dev-only proxy to the Zenex testnet backend; a build sets VITE_API_URL instead.
    proxy: {
      '/zenex-api': {
        target: 'https://api-testnet.zenex.trade',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zenex-api/, ''),
        // Log upstream failures in the dev terminal so a 500 is attributable.
        configure: (proxy) => {
          proxy.on('error', (err, req) => console.warn(`[zenex-api proxy] ${req.url}: ${err.message}`))
          proxy.on('proxyRes', (res, req) => {
            if ((res.statusCode ?? 0) >= 500) console.warn(`[zenex-api proxy] ${req.url}: upstream ${res.statusCode}`)
          })
        },
      },
    },
  },
})
