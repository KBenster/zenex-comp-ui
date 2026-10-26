# zenex-comp-ui

Broadcast screen for the Zenex power-hour trading competition: a 1920×1080 stage meant for OBS or a
browser capture. It reads Zenex **testnet** (competitors' fills, prices, config) and turns it into a
PnL race, a ranking, a market view, head-to-head, and event screens (liquidations, phase cards,
countdowns, SHOT O'CLOCK, the drinking wheel, final results).

```bash
npm install
npm run dev          # http://localhost:5173 — proxies /zenex-api -> https://api-testnet.zenex.trade
npm run build        # tsc -b && vite build -> dist/
npm run check:api    # checks every testnet route and field the UI reads (needs a network that reaches zenex.trade)
```

Open `http://localhost:5173/?mock` to run on generated data (no network needed), or without `?mock`
for testnet. The browser never calls the API directly: the Vite dev proxy and the `vercel.json`
rewrite forward `/zenex-api/*`, because config and price routes only answer allow-listed origins.

## Before the event

1. From a network that reaches `zenex.trade`: `npm run check:api`, then again with the real
   `VITE_COMPETITORS` so each competitor's fills are checked. It exits 1 on any problem.
2. Set the environment (`.env.local` locally, Vercel → Settings → Environment Variables; redeploy after changes):

   | Variable | What |
   |---|---|
   | `VITE_COMPETITORS` | One line of JSON: `[{"address":"G…","name":"ben","avatar":"https://…"}]`. `avatar` is a public URL or a path under `public/`. Without it the checked-in placeholder wallets show. |
   | `VITE_COMPETITION_START` | Event start, ISO UTC, e.g. `2026-10-28T19:00:00Z`. The clock, phases and "which trades count" run from it. Without it the clock starts at page load and a reload restarts the event. |

3. Open `?producer` (no `?mock`) and check the health readout is all green (see below).
4. Rehearse: one competitor opens and closes a small trade; it should appear in the trades panel, the race and the ranking.

## Run of show (60 minutes)

| Time | |
|---|---|
| −0:10 | Countdown: POWER HOUR |
| 0:00 | **Build** |
| 9:50 → 10:00 | Countdown → **Hot 1 (XLM)** |
| 15:00 | **Build** |
| 24:50 → 25:00 | Countdown → **Hot 2 (XLM)** |
| 30:00 | **Final** |
| 49:50 → 50:00 | Countdown → **Boost** |
| 60:00 | Bell → **Final results** (frozen at 60:00) |

A phase card shows for 5 s at each phase start. Phases, lengths and labels: `PHASES` in
`src/competition/schedule.ts`. With a start time set, only fills between the start and the bell count.

**Automatic:** liquidation screen (any competitor liquidated; backlog capped at 3), lead-change
caption (new leader held 1st for 5 s, at most one per 20 s), heart burst on a winning close,
final results after the bell.

**On command only:** SHOT O'CLOCK, the drinking wheel, everything in the table below.

## Producer controls

Hover the bottom-right corner for the buttons, or use the keyboard (shortcuts ignore Cmd/Ctrl/Alt).
Open the operator's own tab with `?producer` to pin the panel; keep the OBS tab without it.

| Key | |
|---|---|
| `1` `2` `3` `4` | Scenes: race, ranking, market, head-to-head (strip wipe between) |
| `S` | SHOT O'CLOCK (full screen, 5 s) |
| `W` | Drinking wheel: random competitor, then a challenge (`CHALLENGES` in `src/broadcast/WheelScreen.tsx`) |
| `E` | Show / hide final results (preview mid-event; hide after the bell to show the race) |
| `[` `]` | Token on the market scene |
| `P` | Phase card |
| `C` | Countdown preview |
| `K` | Lead-change caption preview |
| `A` | Head-to-head attack preview |
| `H` | Heart burst on the leader |
| `L` | Replay the latest liquidation · `Esc` dismiss it |
| `B` | Brainrot side panel (`public/brainrot.mp4`) |

URL flags: `?mock`, `?mock&at=9:45` (mock clock at that point), `?scene=board|market|versus`,
`?producer`, `?brainrot`, `?theme=classic` (red/yellow instead of the event green/lime).

### Health readout

Each item is green when fine, red with the reason otherwise: data source (MOCK / LIVE API), market
config (retries every 5 s until it loads), competitors set, start time set, price age (stale past
15 s), and traders loaded (names any that failed; a failed poll keeps the last good data instead of
zeroing the trader).

## Code map

| Path | |
|---|---|
| `src/App.tsx` | Stage, scenes, event queue (liquidations, lead caption, shots, wheel, results), producer keys, health |
| `src/broadcast/` | Scenes (`RaceChart`, `BoardScene`, `MarketScene`, `VersusScene`), overlays, `Motion.tsx`, `WheelScreen`, `WinnerScreen`, theme (`format.ts`) |
| `src/competition/` | Whitelist, fills → positions/PnL (`useCompetitorActivity`), price history + race paths (`useRace`), ranking, schedule |
| `src/lib/zenexApi.ts` | Backend client; `src/lib/mock.ts` answers the same routes when `?mock` is on |
| `src/components/charts/` | Bklit UI live line chart (shadcn registry `@bklit`). Two local edits in `live-line-chart.tsx`, both commented: rows keep every field so several lines share data, and the y-range covers every line. Re-adding the component from the registry drops them. |
| `scripts/check-api.mjs` | `npm run check:api` |

Motion is our own CSS after [yui540.com/motions](https://yui540.com/motions) (numbers noted in
`src/index.css` and `Motion.tsx`). Fonts: Dela Gothic One and Noto Sans JP (Google Fonts).

## Known limits

- PnL counts the latest 100 fills per competitor per poll (the API maximum).
- Unrealised PnL is marked to the live ticker; funding and borrowing accrued on an open position
  are not in it until a fill realises them.
- The ranking and race count the competition market (XLM) only; the market scene's trades panel
  shows every market.
- Race history before the page was opened is rebuilt from 1-minute closes; after that it is per second.
- A background tab throttles timers. Keep the broadcast tab visible (OBS browser source is fine).
