/**
 * Live fills for one market, shaped as chart markers.
 *
 * Source: the public `GET /v1/markets/:market/trades` feed (indexer-backed, anonymised).
 * Polled every few seconds; the newest page (max 100) is enough for a few-hour competition window.
 * To label markers with a trader name, join on `GET /v1/accounts/:account/trade/fills` or the
 * indexer's Postgres `core.fills` table, which carry the account.
 */
import { useEffect, useState } from 'react'
import { fetchMarketTrades, PRICE_SCALE, type MarketTrade } from '@/lib/zenexApi'
import type { ChartMarker } from './markers'

const COLLATERAL_DECIMALS = 7

export function tradeToMarker(trade: MarketTrade): ChartMarker {
  const kind = trade.kind === 'liquidation' ? 'liquidation' : trade.kind === 'open' || trade.kind === 'increase' ? 'open' : 'close'
  const notional = Number(trade.notionalAtomic) / 10 ** COLLATERAL_DECIMALS
  const sideLabel = trade.side === 'long' ? 'Long' : 'Short'
  const label =
    trade.kind === 'liquidation'
      ? `LIQ ${sideLabel} ${notional.toFixed(0)}`
      : `${trade.kind === 'open' || trade.kind === 'increase' ? '' : 'Close '}${sideLabel} ${notional.toFixed(0)}`
  return {
    id: trade.id,
    time: Math.floor(Date.parse(trade.occurredAt) / 1000),
    price: Number(trade.priceAtomic) / PRICE_SCALE,
    side: trade.side,
    kind,
    label,
  }
}

export function useMarketFills(marketId: string | undefined, enabled: boolean, pollMs = 5_000): ChartMarker[] {
  const [markers, setMarkers] = useState<ChartMarker[]>([])
  useEffect(() => {
    if (!marketId || !enabled) {
      setMarkers([])
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const page = await fetchMarketTrades(marketId, 100)
        if (cancelled) return
        setMarkers(page.items.map(tradeToMarker))
      } catch {
        /* keep the last good set */
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), pollMs)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [marketId, enabled, pollMs])
  return markers
}
