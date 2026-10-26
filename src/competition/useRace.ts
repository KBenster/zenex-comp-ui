/**
 * Price history for the whole competition (1m closes backfilled, then the 1 Hz ticker) and each
 * trader's PnL path over it: realised PnL of fills so far + open positions marked to that price.
 */
import { useEffect, useMemo, useState } from 'react'
import { fetchHistory, fetchTickers, PRICE_SCALE } from '@/lib/zenexApi'
import { positionPnl } from './ranking'
import { deriveOpenPositions, netPnl, type CompetitorSummary } from './useCompetitorActivity'
import { START_SEC } from './schedule'

export interface PricePoint {
  t: number
  price: number
}

export function usePriceHistory(chartSymbol: string | undefined, marketId: string | undefined) {
  const [points, setPoints] = useState<PricePoint[]>([])
  /** Feed's own observation time (unix s) of the last ticker, for the producer's staleness readout. */
  const [observedAt, setObservedAt] = useState<number | null>(null)

  useEffect(() => {
    if (!chartSymbol || !marketId) return
    let cancelled = false
    setPoints([])
    fetchHistory(chartSymbol, '1', START_SEC, Date.now() / 1000)
      .then((bars) => {
        if (cancelled) return
        // Bar `time` is the open; its close belongs at the end of the minute.
        const backfill = bars.map((b) => ({ t: b.time + 60, price: b.close })).filter((p) => p.t >= START_SEC && p.t <= Date.now() / 1000)
        setPoints((live) => [...backfill.filter((p) => !live.length || p.t < live[0]!.t), ...live])
      })
      .catch(() => {})
    const tick = async () => {
      try {
        const t = (await fetchTickers()).find((x) => x.marketId === marketId)
        if (!t || cancelled) return
        setObservedAt(t.observationsTimestamp)
        const point = { t: Date.now() / 1000, price: Number(t.price) / PRICE_SCALE }
        // ponytail: one point per second for the whole event (~1.5k for 24 min); decimate if events get long
        setPoints((prev) => [...prev, point])
      } catch {
        /* one missed tick is fine */
      }
    }
    void tick()
    const id = setInterval(() => void tick(), 1_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [chartSymbol, marketId])

  return { points, observedAt }
}

export interface RacePath {
  summary: CompetitorSummary
  /** [seconds since start, PnL USDC] */
  points: [number, number][]
}

export function useRacePaths(summaries: CompetitorSummary[], prices: PricePoint[]): RacePath[] {
  return useMemo(
    () =>
      summaries
        .filter((s) => s.competitor.address)
        .map((summary) => {
          const fills = [...summary.fills].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
          const points: [number, number][] = [[0, 0]]
          let i = 0
          let realized = 0
          let open = deriveOpenPositions(summary.competitor, [])
          const mark = (t: number, price: number) => points.push([t - START_SEC, realized + open.reduce((sum, p) => sum + positionPnl(p, price), 0)])
          for (const { t, price } of prices) {
            if (t < START_SEC) continue // ticks from before the start are not part of the race
            // Apply each fill at its own time and price, so PnL steps at the trade instead of sloping to the next sample.
            while (i < fills.length && Date.parse(fills[i]!.occurredAt) / 1000 <= t) {
              const fill = fills[i]!
              const ft = Date.parse(fill.occurredAt) / 1000
              const fp = Number(fill.priceAtomic) / PRICE_SCALE
              mark(ft, fp)
              realized += netPnl(fill)
              i++
              open = deriveOpenPositions(summary.competitor, fills.slice(0, i))
              mark(ft, fp)
            }
            mark(t, price)
          }
          return { summary, points }
        }),
    [summaries, prices],
  )
}
