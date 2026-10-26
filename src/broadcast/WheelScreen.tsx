/**
 * Drinking wheel (producer key W): the left wheel picks a trader, then the right wheel picks the
 * challenge, then a result banner. Picks are random; edit CHALLENGES to change the slices.
 */
import { useEffect, useState } from 'react'
import type { Competitor } from '@/competition/whitelist'
import { ACCENT, ON_PRIMARY, PRIMARY, traderColor } from './format'

/** `wheel` is the short slice label; `en` is the result banner. */
export const CHALLENGES: { wheel: string; en: string }[] = [
  { wheel: 'SHOT', en: 'SHOT' },
  { wheel: 'DOUBLE', en: 'DOUBLE SHOT' },
  { wheel: 'BARTENDER', en: "BARTENDER'S CHOICE" },
  { wheel: 'PICK 1', en: 'PICK SOMEONE TO DRINK' },
  { wheel: 'ALL DRINK', en: 'EVERYONE DRINKS' },
  { wheel: 'CHUG', en: 'CHUG' },
  { wheel: 'MAX LEV', en: 'NEXT TRADE AT MAX LEVERAGE' },
  { wheel: 'TRADE SWAP', en: 'TRADE SWAP: SWAP POSITIONS WITH ANOTHER TRADER' },
  { wheel: 'FLIP IT', en: 'FLIP IT: REVERSE YOUR POSITION' },
  { wheel: 'HANDS OFF', en: 'HANDS OFF: NO TRADING FOR 1 MINUTE' },
  { wheel: 'CLOSE ALL', en: 'CLOSE ALL: CLOSE EVERY POSITION NOW' },
  { wheel: 'BLIND', en: 'BLIND TRADE: NEXT TRADE WITHOUT LOOKING AT THE CHART' },
  { wheel: 'BUDDY', en: 'BUDDY: YOU AND THE LEADER BOTH DRINK' },
  { wheel: 'SAFE', en: 'SAFE!' },
]

const SPIN_MS = 5_000
const GAP_MS = 1_200
const RESULT_MS = 5_000
/** How long the whole screen stays up: two spins, the gap between, then the result. */
export const WHEEL_TOTAL_MS = SPIN_MS * 2 + GAP_MS + RESULT_MS

/** A random pick for both wheels, chosen when the producer presses W. */
export function rollWheel(players: Competitor[]) {
  return { player: Math.floor(Math.random() * players.length), challenge: Math.floor(Math.random() * CHALLENGES.length) }
}

function Wheel({ items, target, spin, size }: { items: { label: string; color: string; ink: string }[]; target: number; spin: boolean; size: number }) {
  const n = items.length
  const seg = 360 / n
  // Six full turns, then stop with the target slice's middle under the pointer at the top.
  const end = 360 * 6 + (360 - (target + 0.5) * seg)
  const r = size / 2
  const wedge = (i: number) => {
    const a0 = ((i * seg - 90) * Math.PI) / 180
    const a1 = (((i + 1) * seg - 90) * Math.PI) / 180
    return `M${r},${r} L${r + r * Math.cos(a0)},${r + r * Math.sin(a0)} A${r},${r} 0 ${seg > 180 ? 1 : 0} 1 ${r + r * Math.cos(a1)},${r + r * Math.sin(a1)} Z`
  }
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="block rounded-full border-[10px] border-black"
        style={{ transform: `rotate(${spin ? end : 0}deg)`, transition: `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.6, 0.12, 1)` }}
      >
        {items.map((it, i) => (
          <g key={i}>
            <path d={wedge(i)} fill={it.color} stroke="#000" strokeWidth={4} />
            {/* Along the radius, reading outward from the hub. */}
            <text
              x={r + r * 0.56}
              y={r}
              fill={it.ink}
              fontSize={n > 10 ? 24 : 30}
              fontWeight={900}
              textAnchor="middle"
              dominantBaseline="middle"
              className="font-display"
              transform={`rotate(${(i + 0.5) * seg - 90} ${r} ${r})`}
            >
              {it.label}
            </text>
          </g>
        ))}
        <circle cx={r} cy={r} r={r * 0.12} fill="#000" />
      </svg>
      {/* Pointer at the top; its tip sits inside the rim so it touches the slices. */}
      <svg viewBox="0 0 60 64" width={60} height={64} className="absolute left-1/2 top-[-22px] -translate-x-1/2">
        <path d="M4 4 H56 L30 60 Z" fill="#fff" stroke="#000" strokeWidth={6} strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export function WheelScreen({ players, pick }: { players: Competitor[]; pick: { player: number; challenge: number } }) {
  // Stages run on timers from mount: spin who, pause, spin what, show the result.
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const t = [
      setTimeout(() => setStage(1), 50),
      setTimeout(() => setStage(2), 50 + SPIN_MS + GAP_MS),
      setTimeout(() => setStage(3), 50 + SPIN_MS * 2 + GAP_MS),
    ]
    return () => t.forEach(clearTimeout)
  }, [])
  const who = players[pick.player]
  const what = CHALLENGES[pick.challenge]!
  return (
    <div className="bg-stage absolute inset-0 z-[39] flex flex-col items-center justify-center">
      <div className="-skew-x-12 px-10 py-2" style={{ background: PRIMARY }}>
        <div className="font-display skew-x-12 text-5xl" style={{ color: ON_PRIMARY }}>
          WHEEL OF DRINKS
        </div>
      </div>
      <div className="mt-12 flex items-start gap-24">
        <div className="flex flex-col items-center gap-5">
          <div className="font-display text-4xl text-neutral-300">WHO</div>
          <Wheel items={players.map((p) => ({ label: p.name.toUpperCase(), color: traderColor(p), ink: '#000' }))} target={pick.player} spin={stage >= 1} size={620} />
          {/* Name as soon as the first wheel has landed. */}
          <div className="h-[70px]">
            {stage >= 2 && who && (
              <div className="zx-boing" style={{ animationDelay: '0s' }}>
                <div className="-skew-x-12 border-4 border-black px-8 py-1" style={{ background: traderColor(who) }}>
                  <div className="font-display skew-x-12 text-5xl text-black">{who.name.toUpperCase()}</div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center gap-5">
          <div className="font-display text-4xl text-neutral-300">WHAT</div>
          <Wheel items={CHALLENGES.map((c, i) => ({ label: c.wheel, color: i % 2 ? PRIMARY : ACCENT, ink: '#000' }))} target={pick.challenge} spin={stage >= 2} size={620} />
          <div className="h-[70px]" />
        </div>
      </div>
      <div className="mt-4 h-[110px]">
        {stage >= 3 && who && (
          <div className="zx-boing" style={{ animationDelay: '0s' }}>
            <div className="-skew-x-12 border-4 border-black px-12 py-4" style={{ background: ACCENT }}>
              <div className="skew-x-12 text-center text-black">
                <div className="font-display text-4xl">
                  {who.name.toUpperCase()} → {what.en}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
