# zenex-comp-ui

Empty front end for the Zenex BTC/USD competition. Same stack as Zenex's own `zenex-ui`, cut down
to the pieces an empty app needs:

| Piece | Zenex uses | Here |
|---|---|---|
| Build | Vite 6 + TypeScript 5.8 (+ `@types/node` for vite.config.ts) | same |
| UI | React 18 | same |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` | same |
| Chain | `@stellar/stellar-sdk`, `@zenith-protocols/zenex-sdk` (GitHub, not on npm) | same |
| Browser shims | `vite-plugin-node-polyfills` for Buffer/process | same |
| Not included | `@creit.tech/stellar-wallets-kit`, `@tanstack/react-query`, `zustand`, Radix UI, lucide icons | add when needed |

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build -> dist/
```

Related: the BTC/USD oracle and signer service live in `../zenex-competition/btc-oracle`.
