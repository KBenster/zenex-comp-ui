import { Avatar } from './Avatar'
import type { CompetitorSummary } from './useCompetitorActivity'
import { shortAddress } from './whitelist'

function usd(n: number): string {
  const sign = n < 0 ? '-' : n > 0 ? '+' : ''
  return `${sign}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pnlClass(n: number): string {
  return n > 0 ? 'text-[#22c55e]' : n < 0 ? 'text-[#ef4444]' : 'text-neutral-400'
}

const RANK_STYLE: Record<number, string> = {
  1: 'text-[#facc15]', // gold
  2: 'text-[#d4d4d8]', // silver
  3: 'text-[#d97706]', // bronze
}

interface CompetitorPanelProps {
  summaries: CompetitorSummary[]
  lastPrice: number | null
}

interface Row extends CompetitorSummary {
  unrealized: number
  /** Realised + unrealised net PnL, USDC. The leaderboard metric. */
  total: number
  /** Total PnL over margin posted on the fetched fills, as a percentage; null when no margin. */
  returnPct: number | null
}

function toRow(s: CompetitorSummary, lastPrice: number | null): Row {
  const unrealized = s.openPositions.reduce((sum, p) => {
    if (lastPrice === null) return sum
    return sum + p.notional * (lastPrice / p.entryPrice - 1) * (p.side === 'long' ? 1 : -1)
  }, 0)
  const total = s.realizedPnl + unrealized
  // The open fill's marginAtomic includes the fee escrow; net of base + impact fee it equals the
  // lifecycle's marginPosted, which is what Zenex's leaderboard divides by for netPnlPercent.
  const marginPosted = s.fills
    .filter((f) => f.kind === 'open' || f.kind === 'increase')
    .reduce((sum, f) => sum + (Number(f.marginAtomic) - Number(f.fees.baseAtomic) - Number(f.fees.impactAtomic)) / 1e7, 0)
  return { ...s, unrealized, total, returnPct: marginPosted > 0 ? (total / marginPosted) * 100 : null }
}

/** Leaderboard: competitors with an address ranked by total net PnL; empty slots listed unranked below. */
export function CompetitorPanel({ summaries, lastPrice }: CompetitorPanelProps) {
  const rows = summaries.map((s) => toRow(s, lastPrice))
  const ranked = rows.filter((r) => r.competitor.address).sort((a, b) => b.total - a.total || b.fills.length - a.fills.length)
  const pending = rows.filter((r) => !r.competitor.address)

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col overflow-y-auto border-l border-[#232428] bg-[#141518] text-sm">
      <div className="flex items-baseline justify-between border-b border-[#232428] px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-neutral-500">Leaderboard</span>
        <span className="text-[10px] uppercase tracking-wide text-neutral-600">net PnL, USDC</span>
      </div>

      {ranked.map((r, i) => {
        const rank = i + 1
        return (
          <div key={r.competitor.address} className={`border-b border-[#232428] px-3 py-2 ${rank === 1 ? 'bg-[#1b1c20]' : ''}`}>
            <div className="flex items-center gap-2">
              <span className={`w-5 text-right font-mono text-base font-semibold tabular-nums ${RANK_STYLE[rank] ?? 'text-neutral-500'}`}>
                {rank}
              </span>
              <Avatar competitor={r.competitor} size={rank === 1 ? 40 : 32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{r.competitor.name}</span>
                  <span className={`font-mono text-base tabular-nums ${pnlClass(r.total)}`}>{usd(r.total)}</span>
                </div>
                <div className="flex justify-between text-xs text-neutral-500">
                  <span title={r.competitor.address}>{shortAddress(r.competitor.address)}</span>
                  <span className="font-mono tabular-nums">
                    {r.returnPct !== null && <span className={pnlClass(r.returnPct)}>{usd(r.returnPct)}% </span>}
                    <span className="text-neutral-600">
                      · {r.fills.length} fills · {r.liquidations} liq
                    </span>
                  </span>
                </div>
              </div>
            </div>
            {r.error && <div className="mt-1 text-xs text-red-400">{r.error}</div>}
            {r.openPositions.map((p) => {
              const upnl = lastPrice === null ? 0 : p.notional * (lastPrice / p.entryPrice - 1) * (p.side === 'long' ? 1 : -1)
              return (
                <div key={p.lifecycleId} className="mt-1 flex items-center justify-between rounded-sm bg-[#18191b] px-2 py-1 text-xs">
                  <span className={p.side === 'long' ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                    {p.side === 'long' ? 'Long' : 'Short'} {p.leverage.toFixed(1)}x
                  </span>
                  <span className="font-mono tabular-nums text-neutral-300">
                    {p.notional.toFixed(0)} @ {p.entryPrice.toPrecision(5)}
                  </span>
                  <span className={`font-mono tabular-nums ${pnlClass(upnl)}`}>{usd(upnl)}</span>
                </div>
              )
            })}
            {r.openPositions.length === 0 && <div className="mt-1 text-xs text-neutral-600">no open position</div>}
          </div>
        )
      })}

      {pending.length > 0 && (
        <>
          <div className="border-b border-[#232428] px-3 py-1.5 text-[10px] uppercase tracking-wide text-neutral-600">
            Not yet registered
          </div>
          {pending.map((r) => (
            <div key={r.competitor.name} className="flex items-center gap-2 border-b border-[#232428] px-3 py-2 opacity-60">
              <span className="w-5 text-right text-neutral-600">–</span>
              <Avatar competitor={r.competitor} size={28} />
              <span className="truncate text-neutral-400">{r.competitor.name}</span>
              <span className="ml-auto text-xs text-neutral-600">address not set</span>
            </div>
          ))}
        </>
      )}

      {summaries.length === 0 && <div className="px-3 py-4 text-xs text-neutral-600">No competitors configured.</div>}
    </aside>
  )
}
