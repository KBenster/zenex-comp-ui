/**
 * Zenex backend read client, limited to what the chart needs.
 *
 * Endpoints (zenex-backend src/prices/routes.ts):
 *   GET /v1/config                      market list, with each market's chart symbol
 *   GET /v1/prices/tickers              latest Chainlink report per market, 1 Hz
 *   GET /v1/prices/udf/history          TradingView UDF bars: symbol, resolution, from, to (unix s)
 *
 * In dev the Vite proxy forwards /zenex-api to the testnet backend; a build sets VITE_API_URL.
 */

import { MOCK, mockResponse } from './mock'

export const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '/zenex-api'

/** TradingView resolutions the backend serves (minutes, or 1D). */
export type Resolution = '1' | '5' | '15' | '60' | '240' | '1D'
export const RESOLUTIONS: readonly Resolution[] = ['1', '5', '15', '60', '240', '1D']

export function resolutionSeconds(resolution: Resolution): number {
  return resolution === '1D' ? 86_400 : Number(resolution) * 60
}

export interface ZenexMarket {
  id: string
  trading: string
  vault: string
  collateral: string
  feedId: string
  udfSymbol: string
  chartSymbol: string
  collateralDecimals: number
}

export interface ZenexConfig {
  markets: ZenexMarket[]
  competitions: unknown[]
}

export interface Bar {
  /** Bar open time, unix seconds. */
  time: number
  open: number
  high: number
  low: number
  close: number
}

export interface Ticker {
  marketId: string
  feedID: string
  /** 18-decimal integers as strings. */
  price: string
  bid: string
  ask: string
  observationsTimestamp: number
}

/** Data Streams prices are int192 at 18 decimals. */
export const PRICE_SCALE = 1e18

async function getJson<T>(path: string, timeoutMs = 10_000): Promise<T> {
  if (MOCK) return mockResponse(path) as T
  const response = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(timeoutMs) })
  const text = await response.text()
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(`${path} returned non-JSON (${response.status})`)
  }
  if (!response.ok) throw new Error(`${path} failed (${response.status})`)
  return payload as T
}

export function fetchConfig(): Promise<ZenexConfig> {
  return getJson<ZenexConfig>('/v1/config')
}

export async function fetchTickers(): Promise<Ticker[]> {
  const body = await getJson<{ data: Ticker[] }>('/v1/prices/tickers', 5_000)
  return body.data
}

interface UdfHistory {
  s: 'ok' | 'no_data' | 'error'
  errmsg?: string
  nextTime?: number
  t?: number[]
  o?: number[]
  h?: number[]
  l?: number[]
  c?: number[]
}

/** One fill of one account, from `GET /v1/accounts/:account/trade/fills` (carries the user). */
export interface AccountFill {
  id: string
  contractId: string
  marketId: string
  user: string
  side: 'long' | 'short'
  kind: 'open' | 'increase' | 'decrease' | 'close' | 'liquidation'
  orderId: string | null
  /** Groups the fills of one position from open to close/liquidation. */
  lifecycleId: string
  priceAtomic: string
  notionalAtomic: string
  tokensAtomic: string
  marginAtomic: string
  fees: { baseAtomic: string; impactAtomic: string; fundingAtomic: string; borrowingAtomic: string; liqFeeAtomic: string }
  /** Gross PnL realised by this fill, collateral atomic, signed. */
  pnlAtomic: string
  returnedMarginAtomic: string | null
  badDebtAtomic: string
  keeper: string
  occurredAt: string
  transactionHash: string
}

/** Newest first, max 100 per page. */
export async function fetchAccountFills(
  account: string,
  marketId?: string,
  limit = 100,
  cursor?: string,
): Promise<{ items: AccountFill[]; nextCursor?: string | null }> {
  const query = new URLSearchParams({ limit: String(limit) })
  if (marketId) query.set('market', marketId)
  if (cursor) query.set('cursor', cursor)
  const body = await getJson<{ data: { items: AccountFill[]; nextCursor?: string | null } }>(
    `/v1/accounts/${encodeURIComponent(account)}/trade/fills?${query}`,
  )
  return body.data
}

/** Bars ascending by time for [from, to] in unix seconds. Empty array when the window has none. */
export async function fetchHistory(
  chartSymbol: string,
  resolution: Resolution,
  from: number,
  to: number,
): Promise<Bar[]> {
  const query = new URLSearchParams({
    symbol: chartSymbol,
    resolution,
    from: String(Math.floor(from)),
    to: String(Math.floor(to)),
  })
  const body = await getJson<UdfHistory>(`/v1/prices/udf/history?${query}`)
  if (body.s === 'error') throw new Error(body.errmsg ?? 'history error')
  if (body.s === 'no_data' || !body.t) return []
  return body.t.map((time, i) => ({
    time,
    open: body.o![i]!,
    high: body.h![i]!,
    low: body.l![i]!,
    close: body.c![i]!,
  }))
}
