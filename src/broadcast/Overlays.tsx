/**
 * Broadcast overlays in the Japanese TV / esports style: slanted bars, outlined display type,
 * bilingual labels. Sizes are stage pixels (1920x1080).
 */
import { useState } from 'react'
import { Avatar } from '@/competition/Avatar'
import { DURATION_SEC, PHASES, clock, type PhaseWindow } from '@/competition/schedule'
import type { Competitor } from '@/competition/whitelist'
import type { AccountFill } from '@/lib/zenexApi'
import { DANGER, ON_PRIMARY, PRIMARY, ACCENT, money, sideLabel } from './format'
import { DropText, HopText, LOGO_SRC, Shatter, WordSweep } from './Motion'

/** Slanted block; content is counter-skewed so text stays upright. */
function Slant({ bg, color = '#000', className = '', children }: { bg: string; color?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`-skew-x-12 ${className}`} style={{ background: bg, color }}>
      <div className="skew-x-12">{children}</div>
    </div>
  )
}

/** Event logo (public/ZENEXLOGO.png, the two koi); an accent "Z" if it fails to load. */
const LOGO_SOURCES = [LOGO_SRC]
function Logo() {
  const [i, setI] = useState(0)
  if (i >= LOGO_SOURCES.length) {
    return (
      <Slant bg={ACCENT} className="flex items-center px-5">
        <span className="font-display text-4xl leading-none">Z</span>
      </Slant>
    )
  }
  return <img src={LOGO_SOURCES[i]} alt="" className="h-[60px] w-[60px] rounded-md object-cover" onError={() => setI((n) => n + 1)} />
}

export function Header({ elapsed, phase }: { elapsed: number; phase: PhaseWindow | null }) {
  return (
    <div className="absolute left-10 top-8 z-20 flex items-stretch gap-2">
      <Logo />
      <Slant bg={PRIMARY} color={ON_PRIMARY} className="flex items-center px-6 py-2">
        <span className="flex items-baseline gap-4">
          <span className="text-2xl font-black tracking-wide">{phase ? '● LIVE' : elapsed < 0 ? 'STARTS IN' : 'FINISHED'}</span>
          <span className="font-display text-4xl tabular-nums">{clock(elapsed < 0 ? -elapsed : Math.min(elapsed, DURATION_SEC))}</span>
        </span>
      </Slant>
      {phase && (
        <Slant bg="#fff" className="px-6 py-1.5">
          <div className="text-2xl font-black leading-tight" style={phase.phase.hot ? { color: PRIMARY } : undefined}>
            {phase.phase.badge}
          </div>
        </Slant>
      )}
    </div>
  )
}

/** Shown for a few seconds when a phase starts, revealed through a growing diamond (yui540 #13): run of show, big slanted title band. */
export function PhaseCard({ phase }: { phase: PhaseWindow }) {
  const accent = phase.phase.hot ? PRIMARY : ACCENT
  return (
    <div className="bg-stage zx-diamond-reveal absolute inset-0 z-30 flex flex-col items-center justify-center">
      <div className="flex flex-wrap justify-center gap-3">
        {PHASES.map((p, i) => (
          <Slant key={i} bg={i === phase.index ? accent : i < phase.index ? '#3f3f46' : '#18181b'} color={i === phase.index ? '#000' : i < phase.index ? '#e4e4e7' : '#71717a'} className="px-6 py-2">
            <div className="text-center">
              <div className="text-2xl font-black">{p.name.toUpperCase()}</div>
            </div>
          </Slant>
        ))}
      </div>
      <div className="mt-16 w-[120%] -rotate-3 py-10 text-center" style={{ background: accent }}>
        <div className="font-display telop text-[200px] leading-none text-white">
          {/* Letters drop in once the diamond has opened (yui540 #16). */}
          <DropText text={phase.phase.jpTitle} delay={0.9} />
        </div>
      </div>
      <div className="font-display telop mt-12 text-9xl leading-none" style={{ color: accent }}>
        {/* English line hops in after the title (yui540 #19). */}
        <HopText text={phase.phase.title.toUpperCase()} delay={1.4} />
        {phase.phase.subtitle && (
          <span className="ml-6 text-white">
            <HopText text={phase.phase.subtitle.toUpperCase()} delay={1.7} />
          </span>
        )}
      </div>
    </div>
  )
}

/** Last 10 s before a phase that asks for it: dims the scene, big number on a solid lime/green block. */
export function Countdown({ next, seconds }: { next: PhaseWindow; seconds: number }) {
  const c = next.phase.countdown!
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 text-center">
      <Slant bg={PRIMARY} color={ON_PRIMARY} className="px-10 py-3">
        <span className="text-5xl font-black">
          {next.phase.badge} <span className="text-3xl">STARTS IN</span>
        </span>
      </Slant>
      {/* Solid block behind the number, swapping lime/green each second; no animation. */}
      <div className="my-8 flex h-[500px] w-[560px] items-center justify-center" style={{ background: seconds % 2 ? PRIMARY : ACCENT }}>
        <span className="font-display text-[380px] leading-none tabular-nums text-black">{seconds}</span>
      </div>
      <div className="text-4xl font-bold text-white">{c.label}</div>
      <div className="mt-2 max-w-4xl text-3xl font-medium text-neutral-300">{c.detail}</div>
    </div>
  )
}

export interface Liquidation {
  competitor: Competitor
  fill: AccountFill
  /** Net loss realised by the liquidation fill, USDC (negative). */
  loss: number
  market: string
}

/** Full screen when a trader gets liquidated: solid red, hazard bands, tilted portrait, 強制ロスカット; hazard tape slides (yui540 #10); shatters away after `holdMs` (yui540 #23). */
export function LiquidatedScreen({ liq, holdMs }: { liq: Liquidation; holdMs: number }) {
  return (
    <>
      <Shatter holdMs={holdMs}>
        <LiquidatedCard liq={liq} />
      </Shatter>
      {/* Opens on a wall of text that sweeps apart to reveal the card (yui540 #11). */}
      <WordSweep text="強制ロスカット LIQUIDATED" />
    </>
  )
}

function LiquidatedCard({ liq }: { liq: Liquidation }) {
  const notional = Number(liq.fill.notionalAtomic) / 1e7
  const margin = Number(liq.fill.marginAtomic) / 1e7
  const price = Number(liq.fill.priceAtomic) / 1e18
  return (
    <div className="flex h-full flex-col" style={{ background: DANGER }}>
      <div className="hazard h-16 shrink-0" />
      <div className="relative flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative -rotate-3 border-8 border-white bg-white">
          <Avatar competitor={liq.competitor} size={300} square />
          {/* Plain translucent tint: Chrome drops filter + mix-blend inside the scaled stage. */}
          <div className="absolute inset-0 opacity-40" style={{ background: DANGER }} />
        </div>
        <Slant bg="#fff" className="relative -mt-6 px-10 py-2">
          <span className="font-display text-6xl">{liq.competitor.name}</span>
        </Slant>
        <div className="font-display telop relative mt-8 text-[170px] leading-none text-white">
          強制ロスカット
        </div>
        <div className="font-display relative mt-4 text-6xl tracking-[0.2em] text-black">LIQUIDATED</div>
        <div className="relative mt-8 text-3xl font-bold text-white">
          {liq.market} {sideLabel(liq.fill.side)} {margin > 0 ? `${(notional / margin).toFixed(0)}x` : ''} ${notional.toLocaleString('en-US', { maximumFractionDigits: 0 })} AT {price.toPrecision(5)}
        </div>
        <div className="font-display telop relative mt-4 text-8xl tabular-nums text-white">
          {money(liq.loss)}
        </div>
      </div>
      <div className="hazard h-16 shrink-0" />
    </div>
  )
}
