/** Motion pieces after yui540.com/motions (5, 7, 10, 11, 16, 19, 20, 23, 24, 45, 47); keyframes live in index.css. */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { DANGER, ON_PRIMARY, PRIMARY, ACCENT } from './format'

/** yui540 #5: a changed character streaks out left while the new one streaks in from the right. */
export function Ticker({ text }: { text: string }) {
  const chars = [...text]
  // Keyed from the right so the digits keep their slots when the length changes (-$9.99 -> -$10.00).
  return (
    <span className="inline-flex">
      {chars.map((c, i) => (
        <TickerChar key={chars.length - i} c={c} />
      ))}
    </span>
  )
}

function TickerChar({ c }: { c: string }) {
  const s = useRef({ cur: c, old: null as string | null, n: 0 })
  if (s.current.cur !== c) s.current = { cur: c, old: s.current.cur, n: s.current.n + 1 }
  const { old, n } = s.current
  return (
    <span className="relative inline-block">
      {old !== null && (
        <span key={`o${n}`} className="zx-char-out absolute inset-0">
          {old}
        </span>
      )}
      <span key={`i${n}`} className={`inline-block ${n ? 'zx-char-in' : ''}`}>
        {c}
      </span>
    </span>
  )
}

const STRIPS = 10
// yui540 #20 starts the strips in this shuffled order within each group of five.
const ORDER = [0.15, 0.05, 0, 0.1, 0.2]
export const WIPE_COVER_MS = 900
const WIPE_COLORS = [PRIMARY, ACCENT]
export const LOGO_SRC = '/ZENEXLOGO.png'

/** yui540 #20: strips slide in from the left until the stage is covered, then out to the right; the event logo rides along. */
export function StripWipe() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[35] flex flex-col overflow-hidden">
      {Array.from({ length: STRIPS }, (_, i) => {
        const d = Math.floor(i / 5) * 0.25 + ORDER[i % 5]!
        // Every other strip shifts half a gap so the logos read as a scatter, not a grid.
        return (
          <div
            key={i}
            className="zx-strip flex flex-1 items-center gap-[110px] overflow-hidden"
            style={{ background: WIPE_COLORS[i % 2], animationDelay: `${d}s, ${WIPE_COVER_MS / 1000 + d}s`, paddingLeft: i % 2 ? 40 : 160 }}
          >
            {Array.from({ length: 9 }, (_, k) => (
              <img key={k} src={LOGO_SRC} alt="" className="h-[100px] w-[100px] shrink-0 rounded-xl" />
            ))}
          </div>
        )
      })}
    </div>
  )
}

// yui540 #23: six shards, each nudged apart then dropped with its own tilt, 60 ms apart.
const SHARDS: { clip: string; top: string; left: string; rx: string; ry: string }[] = [
  { clip: 'polygon(55% 45%, 0% 0%, 62% 0%)', top: '-2%', left: '-2%', rx: '-50deg', ry: '30deg' },
  { clip: 'polygon(55% 45%, 62% 0%, 100% 0%, 100% 48%)', top: '-2%', left: '0%', rx: '-30deg', ry: '10deg' },
  { clip: 'polygon(55% 45%, 100% 48%, 100% 100%, 70% 100%)', top: '-2%', left: '2%', rx: '-20deg', ry: '30deg' },
  { clip: 'polygon(55% 45%, 70% 100%, 22% 100%)', top: '2%', left: '2%', rx: '30deg', ry: '-10deg' },
  { clip: 'polygon(55% 45%, 22% 100%, 0% 100%, 0% 58%)', top: '2%', left: '0%', rx: '20deg', ry: '-20deg' },
  { clip: 'polygon(55% 45%, 0% 58%, 0% 0%)', top: '2%', left: '-2%', rx: '-20deg', ry: '40deg' },
]
/** Spread 0.1 s + fall from 0.5 s, plus the 0.3 s stagger, plus the 1.2 s fall. */
export const SHATTER_MS = 2_000

/** Renders `children` whole, then after `holdMs` shatters it into shards that fall off the stage. */
export function Shatter({ holdMs, children }: { holdMs: number; children: ReactNode }) {
  const hold = holdMs / 1000
  return (
    <div className="absolute inset-0 z-40 overflow-hidden">
      {SHARDS.map((s, i) => {
        const d = hold + i * 0.06
        return (
          <div
            key={i}
            className="zx-shard absolute h-full w-full"
            style={{ clipPath: s.clip, '--top': s.top, '--left': s.left, '--rx': s.rx, '--ry': s.ry, animationDelay: `${d + 0.1}s, ${d + 0.5}s` } as CSSProperties}
          >
            {children}
          </div>
        )
      })}
    </div>
  )
}

const SWEEP_ROWS = 8
/** Roughly when the last row has cleared the stage (3.5 s sweep, rows 0.1 s apart, the tail is slow). */
export const WORD_SWEEP_MS = 3_000

/** yui540 #11: rows of giant text cover the stage, then sweep away alternately right and left. */
export function WordSweep({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[41] flex flex-col overflow-hidden">
      {Array.from({ length: SWEEP_ROWS }, (_, i) => {
        const right = i % 2 === 0
        return (
          <div
            key={i}
            className="zx-sweep flex w-[3840px] flex-1 shrink-0 items-center overflow-hidden whitespace-nowrap"
            style={{ background: right ? '#000' : ACCENT, animationName: right ? 'zx-sweep-right' : 'zx-sweep-left', animationDelay: `${i * 0.1}s` }}
          >
            <span className="font-display px-6 text-[96px] leading-none" style={{ color: right ? DANGER : '#000' }}>
              {`${text}　`.repeat(8)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** yui540 #10: a band of text scrolling on a 5 s loop (content doubled so the loop is seamless). */
export function ScrollBand({ text, className = '', style }: { text: string; className?: string; style?: CSSProperties }) {
  const run = `${text}　`.repeat(6)
  return (
    <div className={`pointer-events-none overflow-hidden whitespace-nowrap ${className}`} style={style}>
      <div className="zx-band-scroll inline-flex">
        <span className="font-display px-4">{run}</span>
        <span className="font-display px-4">{run}</span>
      </div>
    </div>
  )
}

/** The previous value and how many times it has changed, so a change can replay an animation. */
export function useChange<T>(value: T): { old: T | null; n: number } {
  const s = useRef({ cur: value, old: null as T | null, n: 0 })
  if (s.current.cur !== value) s.current = { cur: value, old: s.current.cur, n: s.current.n + 1 }
  return { old: s.current.old, n: s.current.n }
}

/** yui540 #45 / #47: the old value rolls up and out, the new one rolls up in with an overshoot. */
export function Roll({ value, kind }: { value: string | number; kind: 'rank' | 'count' }) {
  const { old, n } = useChange(value)
  return (
    <span className="relative inline-block overflow-hidden align-bottom">
      {old !== null && (
        // Hidden once it has rolled out: its outline otherwise sits as a line above the new value.
        <span key={`o${n}`} className={`absolute inset-0 zx-${kind}-out`} onAnimationEnd={(e) => (e.currentTarget.style.visibility = 'hidden')}>
          {old}
        </span>
      )}
      <span key={`i${n}`} className={`inline-block ${n ? `zx-${kind}-in` : ''}`}>
        {value}
      </span>
    </span>
  )
}

/** yui540 #47: trade-count badge; on a new trade the count rolls and the badge jiggles. */
export function CountBadge({ count }: { count: number }) {
  const { n } = useChange(count)
  return (
    <span key={n} className={`inline-flex h-14 min-w-14 items-center justify-center rounded-full border-[5px] border-black px-3 text-3xl font-black ${n ? 'zx-badge-jiggle' : ''}`} style={{ background: PRIMARY, color: ON_PRIMARY }}>
      <Roll value={count} kind="count" />
    </span>
  )
}

/** yui540 #47: wraps an avatar so it rings like the bell whenever `ring` changes. */
export function Bell({ ring, children }: { ring: number; children: ReactNode }) {
  const { n } = useChange(ring)
  return (
    <span key={n} className={`inline-block origin-top ${n ? 'zx-bell' : ''}`}>
      {children}
    </span>
  )
}

const HEART = 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.4 5c2 0 3.4 1.1 4.1 2.3h3C14.2 6.1 15.6 5 17.6 5 21 5 23.1 8.4 21.6 11.8 19.5 16.4 12 21 12 21z'
const SPARK_Y = [-70, -70, -68] // per spark i % 3, after yui540's -27/-26 at 2.6x scale
const MINIS = [
  { x: '-100%', y: '60%', r: '-10deg', d: 0.9 },
  { x: '-150%', y: '60%', r: '-20deg', d: 0.4 },
  { x: '80%', y: '60%', r: '10deg', d: 0.75 },
  { x: '120%', y: '60%', r: '20deg', d: 0.5 },
  { x: '-10%', y: '20%', r: '-4deg', d: 1.1 },
]
export const HEART_BURST_MS = 2_000

/** yui540 #7: heart pops, ring flashes, 10 sparks fly out every 36deg, mini hearts drift up. Removes itself. */
export function HeartBurst({ size = 64 }: { size?: number }) {
  const [on, setOn] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setOn(false), HEART_BURST_MS)
    return () => clearTimeout(id)
  }, [])
  if (!on) return null
  const pink = '#ff4d8d'
  return (
    <span className="zx-heart-burst pointer-events-none absolute left-1/2 top-1/2 z-10" style={{ width: 0, height: 0 }}>
      <span className="zx-heart-ring absolute left-0 top-0 rounded-full" style={{ width: size * 1.4, height: size * 1.4, background: pink }} />
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="absolute" style={{ left: 0, top: 0 }}>
          <span
            className="zx-spark absolute block rounded-full"
            style={{ width: 10, height: 10, left: -5, top: -5, background: i % 2 ? ACCENT : pink, '--rotate': `${i * 36}deg`, '--translate-y': `${SPARK_Y[i % 3]}px`, animationDelay: `${(i % 3) * 0.1}s` } as CSSProperties}
          />
        </span>
      ))}
      {MINIS.map((m, i) => (
        <span key={i} className="zx-mini-rise absolute" style={{ left: -size * 0.35, top: -size * 0.35, animationDelay: `${m.d}s` }}>
          <svg viewBox="0 0 24 24" width={size * 0.7} height={size * 0.7} className="zx-mini-drift block" style={{ '--x': m.x, '--y': m.y, '--r': m.r, animationDelay: `${m.d}s` } as CSSProperties}>
            <path d={HEART} fill={pink} />
          </svg>
        </span>
      ))}
      <svg viewBox="0 0 24 24" width={size} height={size} className="zx-heart-pop absolute block" style={{ left: -size / 2, top: -size / 2 }}>
        <path d={HEART} fill={pink} stroke="#000" strokeWidth={1.5} />
      </svg>
    </span>
  )
}

/** yui540 #24: キキーッ skids in and stops hard, then the caption boings in. */
export function LeadChange({ name }: { name: string }) {
  return (
    <div className="zx-autohide pointer-events-none absolute inset-x-0 top-[150px] z-[25] flex flex-col items-center" style={{ '--zx-hide-at': '2.75s' } as CSSProperties}>
      <div className="zx-skid font-display telop text-[150px] leading-none" style={{ color: PRIMARY, WebkitTextStroke: '0.06em #fff', paintOrder: 'stroke fill' }}>
        キキーッ！
      </div>
      {/* キキーッ is a tyre-screech sound effect (kept in Japanese as the hero word). */}
      <div className="zx-skid font-display telop -mt-2 text-5xl text-white">SKRRT!</div>
      <div className="zx-boing mt-2">
        <div className="-skew-x-12 px-10 py-3" style={{ background: ACCENT }}>
          <div className="skew-x-12 text-5xl font-black text-black">
            NEW LEADER! <span className="font-display">{name}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** yui540 #16: each character drops in and bounces twice, 0.1 s apart. */
export function DropText({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <span className="inline-flex">
      {[...text].map((c, i) => (
        // Clip per character with room for the outline, as the original clips each glyph.
        <span key={i} className="inline-block overflow-hidden px-[0.06em] py-[0.12em]">
          <span className="zx-letter-drop inline-block" style={{ animationDelay: `${delay + i * 0.1}s` }}>
            {c}
          </span>
        </span>
      ))}
    </span>
  )
}

/** yui540 #19: characters hop in tilted and sway to rest, staggered middle, left, right. */
export function HopText({ text, delay = 0 }: { text: string; delay?: number }) {
  const order = [1, 0, 2]
  return (
    <span className="inline-flex">
      {[...text].map((c, i) => {
        const d = `${delay + (Math.floor(i / 3) * 3 + order[i % 3]!) * 0.15}s`
        return (
          <span key={i} className="zx-hop-x inline-block" style={{ animationDelay: d }}>
            <span className="zx-hop-y inline-block" style={{ animationDelay: d }}>
              <span className="zx-hop-r inline-block whitespace-pre" style={{ animationDelay: d }}>
                {c}
              </span>
            </span>
          </span>
        )
      })}
    </span>
  )
}

/** Power hour: every minute is a shot, on its own full screen. The title boings in like the lead caption. */
export function ShotScreen({ n }: { n: number }) {
  return (
    <div className="zx-autohide absolute inset-0 z-[38] flex flex-col items-center justify-center" style={{ background: ACCENT, '--zx-hide-at': '4.75s' } as CSSProperties}>
      <div className="text-[220px] leading-none">🍺</div>
      <div className="zx-boing mt-4" style={{ animationDelay: '0s' }}>
        <div className="font-display text-[190px] leading-none text-black">SHOT O'CLOCK</div>
      </div>
      <div className="mt-8 flex items-center gap-8">
        <div className="-skew-x-12 bg-black px-10 py-3">
          <div className="skew-x-12 text-6xl font-black" style={{ color: ACCENT }}>
            CHEERS!
          </div>
        </div>
        <div className="font-display text-8xl text-black">#{n}</div>
      </div>
    </div>
  )
}
