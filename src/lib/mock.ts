/**
 * Mock backend for UI work without the Zenex API. On with `?mock` in the URL or VITE_MOCK=1.
 * Answers the same paths getJson() asks for, in the same shapes, so every component runs unchanged.
 * Prices are a deterministic function of time, so history, ticker and fills always agree.
 */

export const MOCK: boolean =
  import.meta.env.VITE_MOCK === '1' || new URLSearchParams(window.location.search).has('mock')

/** Mock markets; the competition trades xlm-usd, the others exist so the market toggle has something to show. */
const MARKETS = [
  { id: 'xlm-usd', symbol: 'XLMUSD', base: 0.18, phase: 0 },
  { id: 'btc-usd', symbol: 'BTCUSD', base: 96_000, phase: 1700 },
  { id: 'eth-usd', symbol: 'ETHUSD', base: 3_400, phase: 3100 },
  { id: 'sol-usd', symbol: 'SOLUSD', base: 190, phase: 4700 },
]
/** Price at unix second t: a few slow waves plus hashed jitter, shifted per market so they do not move in lockstep. */
function priceAt(t: number, base = 0.18, phase = 0): number {
  const u = t + phase
  const jitter = (Math.sin(u * 12.9898) * 43758.5453) % 1
  return base * (1 + 0.03 * Math.sin(u / 5400) + 0.012 * Math.sin(u / 900) + 0.004 * Math.sin(u / 130) + 0.002 * Math.sin(u / 23) + 0.0001 * jitter)
}

const atomic18 = (p: number) => (BigInt(Math.round(p * 1e9)) * 1_000_000_000n).toString()
const atomic7 = (usd: number) => Math.round(usd * 1e7).toString()

function rng(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

/** Mock competition starts 8 minutes before page load, or `?at=m:ss` into the event (schedule.ts reads this). */
const at = new URLSearchParams(window.location.search).get('at')?.match(/^(\d+):(\d\d)$/)
const MOCK_ELAPSED = at ? Number(at[1]) * 60 + Number(at[2]) : 8 * 60
export const MOCK_START = Math.floor(Date.now() / 1000) - MOCK_ELAPSED
const MOCK_END = MOCK_START + 60 * 60 // a power hour
const fillCache = new Map<string, { t: number; fill: unknown }[]>()

/** Every trade of the whole mock competition, generated once; the endpoint releases them as the clock passes. */
function scheduleFor(account: string) {
  const cached = fillCache.get(account)
  if (cached) return cached
  const rand = rng(account)
  const out: { t: number; fill: unknown }[] = []
  let t = MOCK_START + 10 + Math.floor(rand() * 40)
  let n = 0
  while (t < MOCK_END) {
    const side = rand() < 0.5 ? 'long' : 'short'
    const margin = 100 + Math.round(rand() * 400)
    const leverage = [10, 25, 50, 100][Math.floor(rand() * 4)]!
    const notional = margin * leverage
    const lifecycleId = `${account.slice(0, 6)}-lc${n}`
    // Mostly the competition market (XLM); some side trades elsewhere for the all-markets trades panel.
    const mk = rand() < 0.7 ? MARKETS[0]! : MARKETS[1 + Math.floor(rand() * (MARKETS.length - 1))]!
    const px = (at: number) => priceAt(at, mk.base, mk.phase)
    const entry = px(t)
    const fee = notional * 0.0006
    const base = { contractId: 'MOCK', marketId: mk.id, user: account, side, orderId: null, lifecycleId, tokensAtomic: '0', returnedMarginAtomic: null, badDebtAtomic: '0', keeper: 'MOCK', transactionHash: `mock${n}` }
    const noFees = { baseAtomic: '0', impactAtomic: '0', fundingAtomic: '0', borrowingAtomic: '0', liqFeeAtomic: '0' }
    out.push({ t, fill: { ...base, id: `${lifecycleId}-open`, kind: 'open', priceAtomic: atomic18(entry), notionalAtomic: atomic7(notional), marginAtomic: atomic7(margin), fees: { ...noFees, baseAtomic: atomic7(fee) }, pnlAtomic: '0', occurredAt: new Date(t * 1000).toISOString() } })

    // Hold 30 s to 4 min; liquidated if the move eats 90% of margin at any second, or 10% of the time for drama.
    const hold = 30 + Math.floor(rand() * 210)
    let exitT = t
    let liquidated = rand() < 0.1
    for (let s = t + 1; s <= t + hold && !liquidated; s++) {
      exitT = s
      const move = notional * (px(s) / entry - 1) * (side === 'long' ? 1 : -1)
      if (move < -margin * 0.9) liquidated = true
    }
    if (liquidated && exitT === t) exitT = t + Math.floor(hold / 2)
    if (exitT >= MOCK_END) break // leave the last one open
    const exit = px(exitT)
    const pnl = liquidated ? -margin * 0.9 : notional * (exit / entry - 1) * (side === 'long' ? 1 : -1)
    out.push({ t: exitT, fill: { ...base, id: `${lifecycleId}-exit`, kind: liquidated ? 'liquidation' : 'close', priceAtomic: atomic18(exit), notionalAtomic: atomic7(notional), marginAtomic: atomic7(margin), fees: { ...noFees, baseAtomic: atomic7(fee), liqFeeAtomic: liquidated ? atomic7(margin * 0.1) : '0' }, pnlAtomic: atomic7(pnl), occurredAt: new Date(exitT * 1000).toISOString() } })
    t = exitT + 15 + Math.floor(rand() * 90)
    n++
  }
  // Demo: one trader gets liquidated ~30 s after page load, so the automatic screen always shows once.
  if (account.startsWith('GMOCK2')) {
    const t0 = MOCK_START + MOCK_ELAPSED + 8
    const lc = `${account.slice(0, 6)}-demo-liq`
    const base = { contractId: 'MOCK', marketId: 'xlm-usd', user: account, side: 'long', orderId: null, lifecycleId: lc, tokensAtomic: '0', returnedMarginAtomic: null, badDebtAtomic: '0', keeper: 'MOCK', transactionHash: 'mock-demo' }
    const noFees = { baseAtomic: '0', impactAtomic: '0', fundingAtomic: '0', borrowingAtomic: '0', liqFeeAtomic: '0' }
    out.push({ t: t0, fill: { ...base, id: `${lc}-open`, kind: 'open', priceAtomic: atomic18(priceAt(t0)), notionalAtomic: atomic7(40_000), marginAtomic: atomic7(400), fees: noFees, pnlAtomic: '0', occurredAt: new Date(t0 * 1000).toISOString() } })
    out.push({ t: t0 + 22, fill: { ...base, id: `${lc}-liq`, kind: 'liquidation', priceAtomic: atomic18(priceAt(t0 + 22)), notionalAtomic: atomic7(40_000), marginAtomic: atomic7(400), fees: { ...noFees, liqFeeAtomic: atomic7(40) }, pnlAtomic: atomic7(-360), occurredAt: new Date((t0 + 22) * 1000).toISOString() } })
    out.sort((a, b) => a.t - b.t)
  }
  fillCache.set(account, out)
  return out
}

/** Fills up to now, newest first like the API. */
function fillsFor(account: string) {
  const now = Date.now() / 1000
  return scheduleFor(account).filter((x) => x.t <= now).map((x) => x.fill).reverse()
}

export function mockResponse(path: string): unknown {
  const url = new URL(path, 'http://mock')
  if (url.pathname === '/v1/config') {
    return {
      markets: MARKETS.map((m) => ({ id: m.id, trading: 'MOCK', vault: 'MOCK', collateral: 'MOCK', feedId: 'MOCK', udfSymbol: m.symbol, chartSymbol: m.symbol, collateralDecimals: 7 })),
      competitions: [],
    }
  }
  if (url.pathname === '/v1/prices/tickers') {
    const now = Math.floor(Date.now() / 1000)
    return {
      data: MARKETS.map((m) => {
        const p = priceAt(now, m.base, m.phase)
        return { marketId: m.id, feedID: 'MOCK', price: atomic18(p), bid: atomic18(p * 0.9999), ask: atomic18(p * 1.0001), observationsTimestamp: now }
      }),
    }
  }
  if (url.pathname === '/v1/prices/udf/history') {
    const res = url.searchParams.get('resolution')!
    const m = MARKETS.find((x) => x.symbol === url.searchParams.get('symbol')) ?? MARKETS[0]!
    const period = res === '1D' ? 86_400 : Number(res) * 60
    const from = Math.ceil(Number(url.searchParams.get('from')) / period) * period
    const to = Math.min(Number(url.searchParams.get('to')), Date.now() / 1000)
    const out = { s: 'ok', t: [] as number[], o: [] as number[], h: [] as number[], l: [] as number[], c: [] as number[] }
    for (let t = from; t <= to; t += period) {
      const step = Math.max(1, Math.floor(period / 20))
      const samples: number[] = []
      for (let s = t; s <= Math.min(t + period, to); s += step) samples.push(priceAt(s, m.base, m.phase))
      out.t.push(t)
      out.o.push(samples[0]!)
      out.c.push(samples[samples.length - 1]!)
      out.h.push(Math.max(...samples))
      out.l.push(Math.min(...samples))
    }
    return out.t.length ? out : { s: 'no_data' }
  }
  const fills = url.pathname.match(/^\/v1\/accounts\/([^/]+)\/trade\/fills$/)
  if (fills) {
    // Like the real route: `market` narrows to one market, no `market` means every market.
    const market = url.searchParams.get('market')
    const items = (fillsFor(decodeURIComponent(fills[1]!)) as { marketId: string }[]).filter((f) => !market || f.marketId === market)
    return { data: { items, nextCursor: null } }
  }
  throw new Error(`mock: no handler for ${url.pathname}`)
}
