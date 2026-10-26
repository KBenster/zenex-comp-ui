/**
 * Leaderboard, per README: registered competitors ranked by realised + unrealised PnL
 * (unrealised marked to the live ticker), unregistered slots kept apart.
 * Rebuilt locally: upstream App.tsx imports this file but it was never committed.
 */
import type { CompetitorSummary, OpenPosition } from './useCompetitorActivity'

export interface RankedCompetitor extends CompetitorSummary {
  rank: number | null
  unrealizedPnl: number
  total: number
  returnPct: number | null
}

export interface Leaderboard {
  ranked: RankedCompetitor[]
  pending: RankedCompetitor[]
}

/** notional × (last / entry − 1), sign flipped for shorts. */
export function positionPnl(p: OpenPosition, lastPrice: number | null): number {
  if (lastPrice === null || p.entryPrice <= 0) return 0
  const move = p.notional * (lastPrice / p.entryPrice - 1)
  return p.side === 'long' ? move : -move
}

export function rankCompetitors(summaries: CompetitorSummary[], lastPrice: number | null): Leaderboard {
  const rows = summaries.map((s): RankedCompetitor => {
    const unrealizedPnl = s.openPositions.reduce((sum, p) => sum + positionPnl(p, lastPrice), 0)
    const total = s.realizedPnl + unrealizedPnl
    // ponytail: return = total / margin posted on opens; README says "net of entry fees", refine when the real file turns up
    const margin = s.fills.filter((f) => f.kind === 'open').reduce((sum, f) => sum + Number(f.marginAtomic) / 1e7, 0)
    return { ...s, rank: null, unrealizedPnl, total, returnPct: margin > 0 ? (total / margin) * 100 : null }
  })
  const ranked = rows.filter((r) => r.competitor.address).sort((a, b) => b.total - a.total)
  ranked.forEach((r, i) => (r.rank = i + 1))
  return { ranked, pending: rows.filter((r) => !r.competitor.address) }
}

export const usd = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`
export const pnlClass = (n: number) => (n > 0 ? 'text-[#22c55e]' : n < 0 ? 'text-[#ef4444]' : 'text-neutral-400')
