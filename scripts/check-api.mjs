#!/usr/bin/env node
/**
 * Real-API contract check for the broadcast: fetches every route the UI reads and checks the fields
 * it uses. Run from a network that can reach Zenex (this one filters zenex.trade):
 *
 *   npm run check:api                                   # testnet, default competitors
 *   ZENEX_API=https://api.zenex.trade npm run check:api # mainnet
 *   VITE_COMPETITORS='[{"address":"G…","name":"ben"}]' npm run check:api
 *
 * Exits 1 on any failure, so it can gate a deploy.
 */
const API = (process.env.ZENEX_API ?? 'https://api-testnet.zenex.trade').replace(/\/+$/, '')
const DEFAULT_ADDRESSES = ['CBJTN2SYYZCEGESQMBY3XRE3D622BIL3TKG3Z4D3VOTID5A7HUPEN3IN', 'CDMKJHYT2K24W74FPSVO5IAQMAOMDG4OOWYRPVUGNDDIBWCTUKUZWSY2']
const addresses = process.env.VITE_COMPETITORS
  ? JSON.parse(process.env.VITE_COMPETITORS).map((c) => c.address).filter(Boolean)
  : DEFAULT_ADDRESSES

let failures = 0
const fail = (msg) => {
  failures++
  console.log(`  FAIL ${msg}`)
}
const ok = (msg) => console.log(`  ok   ${msg}`)
const isAtomic = (v) => typeof v === 'string' && /^-?\d+$/.test(v)

async function get(path) {
  const res = await fetch(API + path, { signal: AbortSignal.timeout(15_000) })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error(`${path}: non-JSON (${res.status}): ${text.slice(0, 120)}`)
  }
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${JSON.stringify(body.error ?? body).slice(0, 200)}`)
  return body
}

async function step(name, fn) {
  console.log(name)
  try {
    await fn()
  } catch (e) {
    fail(e.message)
  }
}

let markets = []
await step('GET /v1/config', async () => {
  const cfg = await get('/v1/config')
  markets = cfg.markets ?? []
  if (!Array.isArray(cfg.markets) || markets.length === 0) return fail('markets missing or empty')
  for (const m of markets) {
    if (typeof m.id !== 'string' || typeof m.chartSymbol !== 'string') fail(`market without id/chartSymbol: ${JSON.stringify(m).slice(0, 120)}`)
  }
  ok(`${markets.length} market(s): ${markets.map((m) => m.id).join(', ')}`)
  if (!markets.some((m) => m.id === 'xlm-usd')) fail('no xlm-usd market (App.tsx picks xlm-usd for the competition, else the first)')
})

await step('GET /v1/prices/tickers', async () => {
  const body = await get('/v1/prices/tickers')
  if (!Array.isArray(body.data)) return fail('data is not a list')
  const now = Date.now() / 1000
  for (const m of markets) {
    const t = body.data.find((x) => x.marketId === m.id)
    if (!t) {
      fail(`no ticker for ${m.id} (its chart and price will stay empty)`)
      continue
    }
    if (!isAtomic(t.price)) fail(`${m.id} price not an atomic string: ${t.price}`)
    if (typeof t.observationsTimestamp !== 'number') fail(`${m.id} observationsTimestamp not a number`)
    const age = Math.round(now - t.observationsTimestamp)
    const price = Number(t.price) / 1e18
    age > 15 ? fail(`${m.id} ticker is ${age}s old`) : ok(`${m.id} ${price} (${age}s old)`)
  }
})

await step('GET /v1/prices/udf/history (1m, last hour)', async () => {
  const to = Math.floor(Date.now() / 1000)
  for (const m of markets) {
    const q = new URLSearchParams({ symbol: m.chartSymbol, resolution: '1', from: String(to - 3600), to: String(to) })
    const h = await get(`/v1/prices/udf/history?${q}`)
    if (h.s === 'error') fail(`${m.id}: s=error ${h.errmsg ?? ''}`)
    else if (h.s === 'no_data' || !h.t?.length) fail(`${m.id}: no bars in the last hour`)
    else if (!['o', 'h', 'l', 'c'].every((k) => Array.isArray(h[k]) && h[k].length === h.t.length)) fail(`${m.id}: o/h/l/c arrays missing or uneven`)
    else ok(`${m.id}: ${h.t.length} bars`)
  }
})

const KINDS = new Set(['open', 'increase', 'decrease', 'close', 'liquidation'])
for (const address of addresses) {
  await step(`GET /v1/accounts/${address.slice(0, 6)}…/trade/fills`, async () => {
    const body = await get(`/v1/accounts/${encodeURIComponent(address)}/trade/fills?limit=100`)
    const items = body.data?.items
    if (!Array.isArray(items)) return fail('data.items is not a list')
    if (items.length === 0) return ok('no fills yet (fine before the event; nothing else to check)')
    let bad = 0
    for (const f of items) {
      const problems = []
      for (const k of ['id', 'lifecycleId', 'marketId', 'occurredAt']) if (typeof f[k] !== 'string') problems.push(k)
      if (!KINDS.has(f.kind)) problems.push(`kind=${f.kind}`)
      if (f.side !== 'long' && f.side !== 'short') problems.push(`side=${f.side}`)
      for (const k of ['priceAtomic', 'notionalAtomic', 'marginAtomic', 'pnlAtomic']) if (!isAtomic(f[k])) problems.push(k)
      for (const k of ['baseAtomic', 'impactAtomic', 'fundingAtomic', 'borrowingAtomic', 'liqFeeAtomic']) if (!isAtomic(f.fees?.[k])) problems.push(`fees.${k}`)
      if (Number.isNaN(Date.parse(f.occurredAt))) problems.push('occurredAt unparseable')
      if (problems.length) {
        bad++
        if (bad <= 3) fail(`fill ${f.id}: ${problems.join(', ')}`)
      }
    }
    if (!bad) ok(`${items.length} fills, all fields the UI reads are present`)
    else if (bad > 3) fail(`…and ${bad - 3} more bad fills`)
    const kinds = [...new Set(items.map((f) => f.kind))].join(', ')
    const mkts = [...new Set(items.map((f) => f.marketId))].join(', ')
    ok(`kinds seen: ${kinds}; markets: ${mkts}`)
  })
}

console.log(failures ? `\n${failures} problem(s). Fix before the event.` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
