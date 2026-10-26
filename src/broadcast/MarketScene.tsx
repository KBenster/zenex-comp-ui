/**
 * Market: token chips (producer switches with [ and ]), big live price with its move over the
 * window, the live chart, and a side panel of the latest trades the competitors placed on any market.
 */
import { useEffect, useState } from 'react'
import { LivePriceChart, formatPrice } from '@/chart/LivePriceChart'
import { Avatar } from '@/competition/Avatar'
import { START_SEC, clock } from '@/competition/schedule'
import type { PricePoint } from '@/competition/useRace'
import { netPnl, type CompetitorSummary } from '@/competition/useCompetitorActivity'
import { fetchAccountFills, type AccountFill, type ZenexMarket } from '@/lib/zenexApi'
import type { Competitor } from '@/competition/whitelist'
import { ACCENT, DANGER, LOSS, ON_PRIMARY, PRIMARY, PROFIT, money, sideLabel } from './format'
import { Ticker } from './Motion'

const WINDOW_S = 120
const TRADE_ROWS = 9
const label = (m: ZenexMarket) => m.chartSymbol.replace(/USD$/, '')
const POLL_MS = 3_000

/**
 * Every competitor's latest fills on every market (the ranking only reads the competition market).
 * Only polls while the market scene is up.
 */
function useAllTrades(competitors: Competitor[]) {
  const [trades, setTrades] = useState<{ competitor: Competitor; fill: AccountFill }[]>([])
  const key = competitors.map((c) => c.address).join(',')
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const lists = await Promise.all(
        competitors.map(async (competitor) => {
          try {
            return (await fetchAccountFills(competitor.address, undefined, 100)).items.map((fill) => ({ competitor, fill }))
          } catch {
            return [] // one trader failing to load should not blank the panel
          }
        }),
      )
      if (!cancelled) setTrades(lists.flat())
    }
    void load()
    const id = setInterval(() => void load(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return trades
}

export function MarketScene({ markets, view, points, summaries }: { markets: ZenexMarket[]; view: ZenexMarket; points: PricePoint[]; summaries: CompetitorSummary[] }) {
  const last = points[points.length - 1]?.price
  const now = points[points.length - 1]?.t ?? 0
  const ref = points.find((p) => p.t >= now - WINDOW_S)?.price
  const change = last !== undefined && ref ? (last / ref - 1) * 100 : 0

  const all = useAllTrades(summaries.map((s) => s.competitor).filter((c) => c.address))
  const tokenOf = (marketId: string) => {
    const m = markets.find((x) => x.id === marketId)
    return m ? label(m) : marketId.split('-')[0]!.toUpperCase()
  }
  const trades = all
    .map(({ competitor, fill }) => ({ s: { competitor }, f: fill, t: Date.parse(fill.occurredAt) / 1000 }))
    .sort((a, b) => b.t - a.t)
    .slice(0, TRADE_ROWS)

  return (
    <div className="flex h-full gap-6 px-10 pb-8">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex gap-2">
          {markets.map((m) => (
            <div key={m.id} className="-skew-x-12 px-5 py-1" style={m.id === view.id ? { background: ACCENT, color: '#000' } : { background: '#1c1c22', color: '#a1a1aa' }}>
              <div className="font-display skew-x-12 text-2xl">{label(m)}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-baseline gap-6">
          <span className="font-display text-5xl">{label(view)}/USD</span>
          {last !== undefined && (
            <span className="font-display text-4xl tabular-nums" style={{ color: change >= 0 ? PROFIT : LOSS }}>
              {change >= 0 ? '+' : ''}
              {change.toFixed(2)}% <span className="text-2xl text-neutral-400">2 MIN</span>
            </span>
          )}
        </div>
        {last !== undefined && (
          <div className="font-display telop mt-2 text-[120px] leading-none tabular-nums" style={{ color: ACCENT }}>
            <Ticker text={formatPrice(last)} />
          </div>
        )}
        <div className="mt-4 min-h-0 flex-1">
          <LivePriceChart points={points} window={WINDOW_S} />
        </div>
      </div>

      <aside className="flex w-[560px] shrink-0 flex-col">
        <div className="flex items-center gap-4">
          <div className="-skew-x-12 px-6 py-1" style={{ background: PRIMARY }}>
            <div className="font-display skew-x-12 text-4xl" style={{ color: ON_PRIMARY }}>
              TRADES
            </div>
          </div>
          <span className="font-display text-2xl tracking-[0.3em] text-neutral-400">ALL MARKETS</span>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {trades.map(({ s, f, t }) => {
            const liq = f.kind === 'liquidation'
            const exit = f.kind === 'close' || f.kind === 'decrease' || liq
            const pnl = netPnl(f)
            const size = Number(f.notionalAtomic) / 1e7
            const lev = Number(f.marginAtomic) > 0 ? Number(f.notionalAtomic) / Number(f.marginAtomic) : 0
            return (
              <div key={`${s.competitor.address}:${f.id}`} className="flex items-center gap-3 bg-[#111116] px-4 py-2" style={liq ? { background: DANGER } : undefined}>
                <Avatar competitor={s.competitor} size={52} square />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="font-display truncate text-2xl">{s.competitor.name}</div>
                  <div className="text-lg font-bold" style={{ color: liq ? '#fff' : f.side === 'long' ? PROFIT : LOSS }}>
                    <span className="text-white">{tokenOf(f.marketId)}</span> {liq ? 'LIQUIDATED' : `${sideLabel(f.side)} ${exit ? 'CLOSE' : 'OPEN'}`} $
                    {size.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    {!exit && lev > 0 ? ` ${lev.toFixed(0)}x` : ''}
                  </div>
                </div>
                <div className="text-right leading-tight">
                  {exit && (
                    <div className="font-display text-2xl tabular-nums" style={{ color: liq ? '#fff' : pnl >= 0 ? PROFIT : LOSS }}>
                      {money(pnl)}
                    </div>
                  )}
                  <div className="text-lg tabular-nums text-neutral-400" style={liq ? { color: '#fff' } : undefined}>
                    {/* Event clock for trades in the event; wall-clock time for older ones (0:00 would be wrong). */}
                    {t >= START_SEC ? clock(t - START_SEC) : new Date(t * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )
          })}
          {trades.length === 0 && <div className="text-2xl text-neutral-500">NO TRADES YET</div>}
        </div>
      </aside>
    </div>
  )
}
