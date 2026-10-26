import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { fileURLToPath } from 'node:url'

const API = new URL(process.env.ZENEX_API ?? 'https://arena.robeart.me/api')

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
    // Dev-only proxy to the same backend vercel.json rewrites to in production (the arena the
    // competition runs on). Override with ZENEX_API=https://api-testnet.zenex.trade npm run dev.
    proxy: {
      '/zenex-api': {
        target: API.origin,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zenex-api/, API.pathname.replace(/\/$/, '')),
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
