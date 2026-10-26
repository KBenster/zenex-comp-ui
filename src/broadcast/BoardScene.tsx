/**
 * Ranking (ランキング): slanted rows with 1位/2位/3位, market + side, outlined PnL; gap to 2nd underneath.
 * Rows slide to their new place when ranks change and the rank rolls (yui540 #45); each avatar carries a
 * trade-count badge that bumps on a new trade while the avatar rings like a bell (yui540 #47).
 */
import { useLayoutEffect, useRef } from 'react'
import { Avatar } from '@/competition/Avatar'
import type { Leaderboard } from '@/competition/ranking'
import { LOSS, ON_PRIMARY, PROFIT, RANK_COLOR, PRIMARY, ACCENT, money, ordinal, sideLabel, traderColor } from './format'
import { Bell, CountBadge, Roll, Ticker } from './Motion'

export function BoardScene({ leaderboard, market }: { leaderboard: Leaderboard; market: string }) {
  const { ranked } = leaderboard
  const lead = ranked.length >= 2 ? ranked[0]!.total - ranked[1]!.total : null

  // FLIP: remember each row's top; after a reorder, start moved rows at their old spot and let them
  // travel to the new one, overshooting 20% at 60% like #45's page number.
  const rows = useRef(new Map<string, HTMLDivElement>())
  const tops = useRef(new Map<string, number>())
  const order = ranked.map((r) => r.competitor.address).join(',')
  useLayoutEffect(() => {
    for (const [address, el] of rows.current) {
      const top = el.offsetTop
      const before = tops.current.get(address)
      tops.current.set(address, top)
      if (before === undefined || before === top) continue
      const dy = before - top
      el.animate(
        [{ transform: `translateY(${dy}px)` }, { transform: `translateY(${-dy * 0.2}px)`, offset: 0.6 }, { transform: 'translateY(0)' }],
        { duration: 600, easing: 'ease-in-out' },
      )
    }
  }, [order])

  return (
    <div className="flex h-full flex-col justify-center gap-5 px-[140px]">
      <div className="mb-4 flex items-center gap-5">
        <div className="-skew-x-12 px-8 py-2" style={{ background: PRIMARY }}>
          <div className="font-display skew-x-12 text-5xl" style={{ color: ON_PRIMARY }}>RANKING</div>
        </div>
      </div>
      {ranked.map((r) => {
        const rank = r.rank ?? 0
        const pos = r.openPositions[0]
        const trades = r.fills.filter((f) => f.kind === 'open').length
        return (
          // FLIP runs on this unskewed wrapper; animating the row itself would drop its slant.
          <div
            key={r.competitor.address}
            ref={(el) => {
              if (el) rows.current.set(r.competitor.address, el)
              else rows.current.delete(r.competitor.address)
            }}
          >
            <div
              className={`-skew-x-12 border-l-[10px] bg-[#111116] px-10 py-5 ${rank === 1 ? 'bg-[#1c1a10]' : ''}`}
              style={{ borderColor: traderColor(r.competitor) }}
            >
              <div className="skew-x-12 grid grid-cols-[190px_96px_1fr_340px_360px] items-center gap-6">
                <span className="font-display telop text-7xl leading-none" style={{ color: RANK_COLOR[rank] ?? '#a1a1aa' }}>
                  <Roll value={ordinal(rank)} kind="rank" />
                </span>
                <span className="relative inline-block">
                  <Bell ring={trades}>
                    <Avatar competitor={r.competitor} size={88} square />
                  </Bell>
                  <span className="absolute -right-7 -top-7">
                    <CountBadge count={trades} />
                  </span>
                </span>
                <span className="font-display truncate text-6xl">{r.competitor.name}</span>
                <span>
                  {pos && (
                    <span className="inline-flex items-center gap-3">
                      <span className="font-display text-5xl">{market}</span>
                      <span className="-skew-x-12 whitespace-nowrap px-3 py-1 text-2xl font-black text-black" style={{ background: pos.side === 'long' ? PROFIT : LOSS }}>
                        <span className="inline-block skew-x-12">
                          {sideLabel(pos.side)} <span className="font-display">{pos.leverage.toFixed(0)}x</span>
                        </span>
                      </span>
                    </span>
                  )}
                </span>
                <span className="font-display telop text-right text-7xl tabular-nums" style={{ color: r.total >= 0 ? PROFIT : LOSS }}>
                  <Ticker text={money(r.total)} />
                </span>
              </div>
            </div>
          </div>
        )
      })}
      {lead !== null && (
        <div className="mt-8 -skew-x-12 self-center px-10 py-3" style={{ background: ACCENT }}>
          <div className="skew-x-12 text-4xl font-black text-black">
            {ranked[0]!.competitor.name} LEADS BY <span className="font-display">{money(lead).slice(1)}</span>
          </div>
        </div>
      )}
      {ranked.length === 0 && <div className="text-center text-3xl text-neutral-500">NO TRADERS REGISTERED YET</div>}
    </div>
  )
}
