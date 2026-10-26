/**
 * Final results after the bell: champion big (crown, final PnL), 2nd and 3rd beside, the rest below.
 * Standings are frozen at the bell (see finalStandings), so open positions moving after the end
 * cannot change the winner on screen.
 */
import { Avatar } from '@/competition/Avatar'
import { DURATION_SEC } from '@/competition/schedule'
import type { RacePath } from '@/competition/useRace'
import type { Competitor } from '@/competition/whitelist'
import { ACCENT, LOSS, ON_PRIMARY, PRIMARY, PROFIT, RANK_COLOR, money, ordinal, traderColor } from './format'
import { HopText } from './Motion'

export interface Standing {
  competitor: Competitor
  pnl: number
  rank: number
}

/** Each trader's PnL at the bell, read from the race path (realised + open marked at that second). */
export function finalStandings(paths: RacePath[]): Standing[] {
  return paths
    .map((p) => {
      let pnl = 0
      for (const [t, v] of p.points) if (t <= DURATION_SEC) pnl = v
      return { competitor: p.summary.competitor, pnl }
    })
    .sort((a, b) => b.pnl - a.pnl)
    .map((s, i) => ({ ...s, rank: i + 1 }))
}

function Podium({ s }: { s: Standing }) {
  return (
    <div className="flex w-[420px] flex-col items-center -skew-x-6 border-4 border-black bg-[#111116] px-6 py-6" style={{ borderTopColor: RANK_COLOR[s.rank] }}>
      <div className="flex skew-x-6 flex-col items-center">
        <div className="font-display telop text-6xl" style={{ color: RANK_COLOR[s.rank] }}>
          {ordinal(s.rank)}
        </div>
        <div className="mt-3">
          <Avatar competitor={s.competitor} size={150} square />
        </div>
        <div className="font-display mt-3 text-5xl">{s.competitor.name}</div>
        <div className="font-display telop mt-2 text-5xl tabular-nums" style={{ color: s.pnl >= 0 ? PROFIT : LOSS }}>
          {money(s.pnl)}
        </div>
      </div>
    </div>
  )
}

export function WinnerScreen({ standings }: { standings: Standing[] }) {
  const [first, second, third, ...rest] = standings
  if (!first) return null
  return (
    <div className="bg-stage absolute inset-0 z-[37] flex flex-col items-center justify-center">
      <div className="zx-pill-pop">
        <div className="-skew-x-12 px-10 py-2" style={{ background: PRIMARY }}>
          <div className="font-display skew-x-12 text-5xl" style={{ color: ON_PRIMARY }}>
            FINAL RESULTS
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-16">
        {second && <Podium s={second} />}
        {/* Champion */}
        <div className="flex flex-col items-center">
          <div className="text-[110px] leading-none">👑</div>
          <div className="zx-boing" style={{ animationDelay: '0.2s' }}>
            <div className="border-[10px] bg-black p-1" style={{ borderColor: traderColor(first.competitor) }}>
              <Avatar competitor={first.competitor} size={300} square />
            </div>
          </div>
          <div className="font-display telop mt-4 text-[110px] leading-none" style={{ color: ACCENT }}>
            <HopText text={first.competitor.name} delay={0.8} />
          </div>
          <div className="font-display telop mt-3 text-8xl tabular-nums" style={{ color: first.pnl >= 0 ? PROFIT : LOSS }}>
            {money(first.pnl)}
          </div>
          <div className="mt-3 -skew-x-12 px-8 py-2" style={{ background: ACCENT }}>
            <div className="skew-x-12 text-4xl font-black text-black">CHAMPION</div>
          </div>
        </div>
        {third && <Podium s={third} />}
      </div>

      {rest.length > 0 && (
        <div className="mt-10 flex gap-6">
          {rest.map((s) => (
            <div key={s.competitor.address} className="flex items-center gap-4 bg-[#111116] px-6 py-3">
              <span className="font-display text-4xl text-neutral-400">{ordinal(s.rank)}</span>
              <Avatar competitor={s.competitor} size={56} square />
              <span className="font-display text-3xl">{s.competitor.name}</span>
              <span className="font-display text-3xl tabular-nums" style={{ color: s.pnl >= 0 ? PROFIT : LOSS }}>
                {money(s.pnl)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
