# zenex-comp-ui

Front end for the Zenex trading competition. Same stack as Zenex's own `zenex-ui`, cut down
to what the competition needs.

| Piece | Zenex uses | Here |
|---|---|---|
| Build | Vite 6 + TypeScript 5.8 (+ `@types/node` for vite.config.ts) | same |
| UI | React 18 | same |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` | same |
| Chart | TradingView Charting Library (licensed, vendored in zenex-trade `public/charting_library`) | TradingView **Lightweight Charts** (open source, same look, no licence) |
| Chart data | Backend UDF proxy `/v1/prices/udf/history` + `/v1/prices/tickers` at 1 Hz | same endpoints |
| Chain | `@stellar/stellar-sdk`, `@zenith-protocols/zenex-sdk` (GitHub, not on npm) | same |
| Browser shims | `vite-plugin-node-polyfills` for Buffer/process | same |
| Not included | `@creit.tech/stellar-wallets-kit`, `@tanstack/react-query`, `zustand`, Radix UI, lucide icons | add when needed |

```bash
npm install
npm run dev        # http://localhost:5173, proxies /zenex-api -> https://api-testnet.zenex.trade
npm run build      # tsc -b && vite build -> dist/   (set VITE_API_URL=https://api-testnet.zenex.trade)
```

The testnet API sends no CORS allow-origin for other sites, so the browser never calls it directly:
in dev the Vite proxy forwards `/zenex-api`, on Vercel the rewrite in `vercel.json` does the same.

## Deploying on Vercel

1. Push the folder to a Git repo and import it in Vercel. `vercel.json` sets the framework (Vite) and
   the `/zenex-api/*` rewrite to `https://api-testnet.zenex.trade/*`. No other config.
2. Players: Project → Settings → Environment Variables → `VITE_COMPETITORS`, one line of JSON:
   ```json
   [{"address":"G...","name":"ben","avatar":"https://cdn.discordapp.com/avatars/123/abc.png"},
    {"address":"C...","name":"alice","avatar":"/avatars/alice.png"}]
   ```
   `avatar` is any public image URL (Discord, X, GitHub profile pictures work) or a file you commit
   under `public/avatars/`. Leave `address` empty for a player whose wallet you do not have yet.
3. Redeploy after changing the variable (Deployments → ⋯ → Redeploy). Vite inlines env vars at build
   time, so the change is not live until then. A malformed JSON value falls back to the checked-in
   list in `src/competition/whitelist.ts` and logs the reason in the browser console.

Later, if you want to change players without redeploying: put the JSON in Vercel Edge Config and
read it from a tiny `/api/competitors` function. Not needed for six people.

## What is on screen

`src/App.tsx`: market selector from `/v1/config` (today only xlm-usd), last price from the 1 Hz
ticker, resolution buttons (1m 5m 15m 1h 4h 1D), a "demo markers" toggle.

`src/chart/PriceChart.tsx`: candlestick chart.
- Initial load: last 300 bars for the resolution; scrolling left pages 300 more at a time down to
  Chainlink's history floor (2024-11-10).
- Live tail: every second `/v1/prices/tickers` advances the forming bar, opens a new one on the
  period boundary. Every 30 s the recent window is re-fetched from the backend to reconcile.
- Theme copied from zenex-trade: surface `#18191b`, green `#22c55e`, red `#ef4444`.

## Where fills come from (opens, closes, liquidations)

Every fill is a contract event on the market (zenex-contracts `market/src/events.rs`): `OpenFill`,
`IncreaseFill`, `DecreaseFill`, `CloseFill`, `Liquidation`, each with `user`, `is_long`, `price`
(18-dec), `notional`, `margin`, `pnl`, `keeper`. Zenex's indexer (zenex-indexer) stores them in
Postgres `core.fills` and folds open-to-close runs into `core.position_lifecycles`. The backend
exposes them, no auth, CORS-restricted:

| Route | What | Has account? |
|---|---|---|
| `GET /v1/markets/:market/trades?limit<=100&cursor=` | every fill on the market, newest first: id, side, kind (open/increase/decrease/close/liquidation), priceAtomic, notionalAtomic, tokensAtomic, occurredAt, transactionHash | no (anonymised) |
| `GET /v1/accounts/:account/trade/fills?market=&limit=&cursor=` | one trader's fills with user, orderId, lifecycleId, margin, fees, pnl, keeper | yes |
| `GET /v1/accounts/:account/trade/lifecycles` | one row per position: entryPrice, exitPrice, size, leverage, netPnl, openedAt, finalizedAt, finalizationReason | yes |
| `GET /v1/leaderboards/rolling/{1d,7d}` | ranked traders by netPnl | yes |
| Stellar RPC `getEvents` on the market contract (`stellar events --id CCOIDO… --network testnet`) | raw events, decoded by name, with ledger close time | yes |

## Whitelist: only the competitors are shown

`src/competition/whitelist.ts` holds the competitor list, `{ address, name, avatar }`, six slots.
Replace the two demo testnet addresses with the real participants before the event; a slot with an
empty address is listed in the panel but nothing is fetched for it.

**Profile pictures**: static files, no backend. Drop `public/avatars/<handle>.png` (or .jpg/.svg,
square, about 256px) and point the slot's `avatar` at `/avatars/<handle>.png`. The six `.svg` files
there are generated initials placeholders. `src/competition/Avatar.tsx` renders the picture and
falls back to initials when the file is missing or fails to load. The `name` field is the username
shown on chart markers and in the panel.

`src/competition/useCompetitorActivity.ts` polls each competitor's account fills route every 5 s
(one request per competitor, in parallel) and derives:
- **markers** for every fill, labelled `name [close|LIQ] L|S size`, e.g. `ben L250`;
- **open positions**: a lifecycle is open while its newest fill is not a close or liquidation.
  Notional = opens + increases − decreases, entry = notional-weighted average of open/increase
  prices, leverage = notional / margin at the latest fill. Each open position adds a dashed entry
  line labelled `name Long 5.0x`;
- **realised net PnL** = Σ (gross pnl − base − impact − funding − borrowing − liq fee) over the
  fetched fills, which equals the lifecycle netPnl the Zenex leaderboard ranks on (checked against
  `/v1/leaderboards/rolling/7d`).

`src/competition/CompetitorPanel.tsx` lists competitors ranked by realised + unrealised PnL, with
unrealised PnL marked to the live ticker: `notional × (last / entry − 1)`, sign flipped for shorts.

Limits: 100 fills per competitor per poll (the API maximum); for a one-hour event that is plenty.
Funding and borrowing accrued on an open position are not in the unrealised figure until a fill
realises them. `src/chart/useMarketFills.ts` (the anonymised all-market feed) is kept but unused.

Known rendering limit: Lightweight Charts stacks several markers on the same bar vertically, so on
coarse resolutions a busy bar becomes a column of labels. On 1m/5m during a one-hour event this is fine.

## Markers

`src/chart/markers.ts` defines the marker shape the fills feed produces:

```ts
interface ChartMarker {
  id: string            // stable per fill
  time: number          // unix seconds of the fill
  price: number         // natural units, e.g. 0.1766
  side: 'long' | 'short'
  kind: 'open' | 'close' | 'liquidation'
  label?: string        // "Long 5x", a trader name
  entryLine?: boolean   // dashed horizontal line at price while open
}
```

Pass an array as `<PriceChart markers={...}>`. Opens draw a circle below (long) or above (short)
the bar, closes a square, liquidations an orange arrow with "LIQ". This mirrors what zenex-trade's
`useChartPositionMarkers` draws with the licensed library (entry dot + dashed entry line).
Later: map the market's `open_fill` / `close_fill` / `liquidation` events from the indexer onto this
shape; the fill price is in the feed's 18-decimal precision, divide by 1e18.

Related: the BTC/USD oracle and signer service live in `../zenex-competition/btc-oracle`.
