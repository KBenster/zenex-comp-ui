/**
 * Fills, open positions and PnL for the whitelisted competitors only.
 *
 * Source: `GET /v1/accounts/:account/trade/fills?market=…` per competitor, polled together every
 * few seconds. Open positions are derived from the fills: a lifecycle (one position from open to
 * close) is open while its newest fill is not a close or liquidation. Net PnL per fill is gross
 * PnL minus every fee, which matches the lifecycle netPnl the leaderboard ranks on.
 */
import { useEffect, useMemo, useState } from 'react'
import type { ChartMarker } from '@/chart/markers'
import { fetchAccountFills, PRICE_SCALE, type AccountFill } from '@/lib/zenexApi'
import type { Competitor } from './whitelist'

const COLLATERAL_DECIMALS = 7
const toUsd = (atomic: string | bigint) => Number(atomic) / 10 ** COLLATERAL_DECIMALS
const toPrice = (atomic: string) => Number(atomic) / PRICE_SCALE

export interface OpenPosition {
  competitor: Competitor
  lifecycleId: string
  side: 'long' | 'short'
  /** Remaining notional in USDC. */
  notional: number
  /** Margin posted at the latest fill, USDC. */
  margin: number
  /** Notional-weighted average entry price. */
  entryPrice: number
  openedAt: number
  leverage: number
}

export interface CompetitorSummary {
  competitor: Competitor
  fills: AccountFill[]
  openPositions: OpenPosition[]
  /** Realised net PnL over all fetched fills, USDC. */
  realizedPnl: number
  liquidations: number
  error?: string
}

function netPnl(fill: AccountFill): number {
  const f = fill.fees
  return toUsd(
    BigInt(fill.pnlAtomic) -
      BigInt(f.baseAtomic) -
      BigInt(f.impactAtomic) -
      BigInt(f.fundingAtomic) -
      BigInt(f.borrowingAtomic) -
      BigInt(f.liqFeeAtomic),
  )
}

export function deriveOpenPositions(competitor: Competitor, fills: AccountFill[]): OpenPosition[] {
  const byLifecycle = new Map<string, AccountFill[]>()
  for (const fill of fills) {
    const list = byLifecycle.get(fill.lifecycleId) ?? []
    list.push(fill)
    byLifecycle.set(fill.lifecycleId, list)
  }
  const open: OpenPosition[] = []
  for (const [lifecycleId, list] of byLifecycle) {
    const ordered = [...list].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
    const last = ordered[ordered.length - 1]!
    if (last.kind === 'close' || last.kind === 'liquidation') continue
    let notional = 0
    let weighted = 0
    let entryNotional = 0
    for (const fill of ordered) {
      const n = toUsd(fill.notionalAtomic)
      if (fill.kind === 'open' || fill.kind === 'increase') {
        notional += n
        weighted += n * toPrice(fill.priceAtomic)
        entryNotional += n
      } else if (fill.kind === 'decrease') {
        notional -= n
      }
    }
    if (notional <= 0 || entryNotional <= 0) continue
    const margin = toUsd(last.marginAtomic)
    open.push({
      competitor,
      lifecycleId,
      side: last.side,
      notional,
      margin,
      entryPrice: weighted / entryNotional,
      openedAt: Math.floor(Date.parse(ordered[0]!.occurredAt) / 1000),
      leverage: margin > 0 ? notional / margin : 0,
    })
  }
  return open
}

export function fillToMarker(competitor: Competitor, fill: AccountFill): ChartMarker {
  const kind = fill.kind === 'liquidation' ? 'liquidation' : fill.kind === 'open' || fill.kind === 'increase' ? 'open' : 'close'
  const sideLabel = fill.side === 'long' ? 'L' : 'S'
  const size = toUsd(fill.notionalAtomic).toFixed(0)
  const verb = fill.kind === 'liquidation' ? 'LIQ' : fill.kind === 'close' || fill.kind === 'decrease' ? 'close' : ''
  return {
    id: `${competitor.address}:${fill.id}`,
    time: Math.floor(Date.parse(fill.occurredAt) / 1000),
    price: toPrice(fill.priceAtomic),
    side: fill.side,
    kind,
    label: `${competitor.name} ${verb} ${sideLabel}${size}`.replace(/\s+/g, ' ').trim(),
  }
}

export function useCompetitorActivity(competitors: Competitor[], marketId: string | undefined, pollMs = 5_000) {
  const [summaries, setSummaries] = useState<CompetitorSummary[]>([])
  const key = competitors.map((c) => c.address).join(',')

  useEffect(() => {
    if (!marketId || competitors.length === 0) {
      setSummaries([])
      return
    }
    let cancelled = false
    const load = async () => {
      const results = await Promise.all(
        competitors.map(async (competitor): Promise<CompetitorSummary> => {
          // A slot without an address yet is listed but never fetched.
          if (!competitor.address) return { competitor, fills: [], openPositions: [], realizedPnl: 0, liquidations: 0 }
          try {
            const page = await fetchAccountFills(competitor.address, marketId, 100)
            const fills = page.items
            return {
              competitor,
              fills,
              openPositions: deriveOpenPositions(competitor, fills),
              realizedPnl: fills.reduce((sum, f) => sum + netPnl(f), 0),
              liquidations: fills.filter((f) => f.kind === 'liquidation').length,
            }
          } catch (e) {
            return { competitor, fills: [], openPositions: [], realizedPnl: 0, liquidations: 0, error: String((e as Error).message ?? e) }
          }
        }),
      )
      if (!cancelled) setSummaries(results)
    }
    void load()
    const timer = window.setInterval(() => void load(), pollMs)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, marketId, pollMs])

  const markers = useMemo<ChartMarker[]>(() => {
    const out: ChartMarker[] = []
    for (const s of summaries) {
      for (const fill of s.fills) out.push(fillToMarker(s.competitor, fill))
      for (const p of s.openPositions) {
        out.push({
          id: `${s.competitor.address}:entry:${p.lifecycleId}`,
          time: p.openedAt,
          price: p.entryPrice,
          side: p.side,
          kind: 'open',
          label: `${s.competitor.name} ${p.side === 'long' ? 'Long' : 'Short'} ${p.leverage.toFixed(1)}x`,
          entryLine: true,
        })
      }
    }
    return out
  }, [summaries])

  return { summaries, markers }
}
