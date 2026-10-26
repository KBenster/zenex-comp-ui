/**
 * Head-to-head of the top two (yui540 #68 mutual follow): avatars roll in from opposite sides,
 * overshoot and settle, the label pill pops; VS and the Zenex fisherman between them ("{leader}
 * goes fishing"), PnL and the gap underneath. When the lead changes, the new leader lunges across
 * and hits the other one.
 */
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/competition/Avatar'
import type { Leaderboard, RankedCompetitor } from '@/competition/ranking'
import { LOSS, ON_PRIMARY, PROFIT, RANK_COLOR, PRIMARY, ACCENT, money, ordinal, sideLabel, traderColor } from './format'
import { Ticker } from './Motion'

function Side({ r, from, market, hit }: { r: RankedCompetitor; from: 'left' | 'right'; market: string; hit?: 'lunge' | 'hit' }) {
  const pos = r.openPositions[0]
  return (
    <div className="flex w-[560px] flex-col items-center">
      <div className={`relative ${from === 'left' ? 'zx-roll-left' : 'zx-roll-right'}`}>
        <div className={hit ? `zx-${hit}` : ''}>
          <div className="rounded-full border-[10px] p-1" style={{ borderColor: traderColor(r.competitor), background: '#000' }}>
            <div className="overflow-hidden rounded-full">
              <Avatar competitor={r.competitor} size={250} />
            </div>
          </div>
        </div>
        {hit === 'hit' && (
          <div className="zx-boing font-display telop absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-6xl" style={{ color: ACCENT, animationDelay: '1.6s' }}>
            HIT!
          </div>
        )}
      </div>
      <div className="font-display telop mt-5 text-5xl" style={{ color: RANK_COLOR[r.rank ?? 0] ?? '#fff' }}>
        {ordinal(r.rank ?? 0)}
      </div>
      <div className="font-display mt-1 text-6xl">{r.competitor.name}</div>
      <div className="font-display telop mt-3 text-7xl tabular-nums" style={{ color: r.total >= 0 ? PROFIT : LOSS }}>
        <Ticker text={money(r.total)} />
      </div>
      <div className="mt-3 h-9 text-2xl font-bold text-neutral-300">{pos ? `${market} ${sideLabel(pos.side)} ${pos.leverage.toFixed(0)}x` : 'NO POSITION'}</div>
    </div>
  )
}

/** `preview` bumps from the producer's A key to replay the attack. */
export function VersusScene({ leaderboard, market, preview = 0 }: { leaderboard: Leaderboard; market: string; preview?: number }) {
  const [a, b] = leaderboard.ranked
  // A lead change while this scene is up: the new leader attacks. Not on first show.
  const prevLeader = useRef<string | null>(null)
  const [attack, setAttack] = useState(0)
  useEffect(() => {
    if (!a) return
    if (prevLeader.current && prevLeader.current !== a.competitor.address) setAttack((n) => n + 1)
    prevLeader.current = a.competitor.address
  }, [a?.competitor.address])
  useEffect(() => {
    if (preview) setAttack((n) => n + 1)
  }, [preview])
  if (!a || !b) return <div className="flex h-full items-center justify-center text-3xl text-neutral-500">NEED TWO REGISTERED TRADERS</div>
  return (
    // Keyed by the pair so the roll-in replays when the top two change.
    <div key={`${a.competitor.address}:${b.competitor.address}:${attack}`} className="flex h-full flex-col items-center justify-center pb-24">
      {/* Pop on a wrapper: the keyframes' transform would otherwise replace the slant. */}
      <div className="zx-pill-pop">
        <div className="-skew-x-12 px-10 py-2" style={{ background: PRIMARY }}>
          <div className="skew-x-12 text-4xl font-black" style={{ color: ON_PRIMARY }}>HEAD TO HEAD</div>
        </div>
      </div>
      <div className="mt-6 flex items-start">
        <Side r={a} from="left" market={market} hit={attack ? 'lunge' : undefined} />
        <div className="flex w-[480px] flex-col items-center">
          <div className="font-display telop text-[130px] leading-none" style={{ color: ACCENT }}>
            VS
          </div>
          {/* The Zenex banner's fisherman: the leader is the one going fishing. */}
          <img src="/fisherman.png" alt="" className="mt-2 h-[300px]" />
          <div className="mt-2 text-center leading-tight">
            <div className="font-display text-3xl" style={{ color: ACCENT }}>
              {a.competitor.name} GOES FISHING
            </div>
          </div>
        </div>
        <Side r={b} from="right" market={market} hit={attack ? 'hit' : undefined} />
      </div>
      <div className="mt-4 -skew-x-12 px-10 py-3" style={{ background: ACCENT }}>
        <div className="skew-x-12 text-4xl font-black text-black">
          GAP <span className="font-display">{money(a.total - b.total).slice(1)}</span>
        </div>
      </div>
    </div>
  )
}
