import { useEffect, useRef, useState } from 'react'
import { BoardScene } from '@/broadcast/BoardScene'
import { BrainrotPanel } from '@/broadcast/BrainrotPanel'
import { MarketScene } from '@/broadcast/MarketScene'
import { Countdown, Header, LiquidatedScreen, PhaseCard, type Liquidation } from '@/broadcast/Overlays'
import { RaceChart } from '@/broadcast/RaceChart'
import { VersusScene } from '@/broadcast/VersusScene'
import { WHEEL_TOTAL_MS, WheelScreen, rollWheel } from '@/broadcast/WheelScreen'
import { WinnerScreen, finalStandings } from '@/broadcast/WinnerScreen'
import { LeadChange, SHATTER_MS, ScrollBand, ShotScreen, StripWipe, WIPE_COVER_MS } from '@/broadcast/Motion'
import { Stage } from '@/broadcast/Stage'
import { ON_PRIMARY, PRIMARY } from '@/broadcast/format'
import { rankCompetitors } from '@/competition/ranking'
import { DURATION_SEC, START_CONFIGURED, WINDOWS, phaseAt, useElapsed } from '@/competition/schedule'
import { netPnl, useCompetitorActivity } from '@/competition/useCompetitorActivity'
import { usePriceHistory, useRacePaths } from '@/competition/useRace'
import { COMPETITORS, COMPETITORS_CONFIGURED, type Competitor } from '@/competition/whitelist'
import { fetchConfig, type ZenexMarket } from '@/lib/zenexApi'
import { MOCK } from '@/lib/mock'

const SCENES = ['race', 'board', 'market', 'versus'] as const
const PRODUCER = new URLSearchParams(window.location.search).has('producer')
/** A ticker older than this is shown as stale in the health readout. */
const STALE_PRICE_S = 15
const CONFIG_RETRY_MS = 5_000
type Scene = (typeof SCENES)[number]
const PHASE_CARD_MS = 5_000
// Liquidation screen holds, then shatters away; the queue moves on once the shards have fallen.
// 6 s hold: the word sweep covers the card for the first ~2.5 s.
const LIQ_HOLD_MS = 6_000
const LIQ_SCREEN_MS = LIQ_HOLD_MS + SHATTER_MS
const MAX_LIQ_BACKLOG = 3
// SHOT O'CLOCK (producer-called) takes the screen this long.
const SHOT_MS = 5_000
const LEAD_CAPTION_MS = 3_000
// A close race see-saws every few seconds; only announce a leader who has held 1st this long,
// and at most one caption per gap. ponytail: fixed numbers, tune on the night if real changes go quiet.
const LEAD_HOLD_MS = 5_000
const LEAD_CAPTION_GAP_MS = 20_000

export default function App() {
  const [market, setMarket] = useState<ZenexMarket | null>(null)
  const [markets, setMarkets] = useState<ZenexMarket[]>([])
  // Token shown on the market scene; the competition itself stays on `market`.
  const [viewId, setViewId] = useState<string | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [scene, setScene] = useState<Scene>(() => {
    const s = new URLSearchParams(window.location.search).get('scene')
    return (SCENES as readonly string[]).includes(s ?? '') ? (s as Scene) : 'race'
  })

  const [attackPreview, setAttackPreview] = useState(0)
  const [brainrot, setBrainrot] = useState(() => new URLSearchParams(window.location.search).has('brainrot'))

  // Config retries every few seconds until it loads: one failed request at page load must not
  // leave the broadcast dead until someone reloads.
  useEffect(() => {
    let cancelled = false
    let timer = 0
    const load = () =>
      fetchConfig()
        .then((cfg) => {
          if (cancelled) return
          setConfigError(null)
          setMarkets(cfg.markets)
          setMarket(cfg.markets.find((m) => m.id === 'xlm-usd') ?? cfg.markets[0] ?? null)
        })
        .catch((e) => {
          if (cancelled) return
          setConfigError(String((e as Error).message ?? e))
          timer = window.setTimeout(load, CONFIG_RETRY_MS)
        })
    void load()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  const marketLabel = market?.chartSymbol.replace(/USD$/, '') ?? ''
  const { summaries } = useCompetitorActivity(COMPETITORS, market?.id, 2_000)
  const { points: prices, observedAt } = usePriceHistory(market?.chartSymbol, market?.id)
  const lastPrice = prices[prices.length - 1]?.price ?? null
  const leaderboard = rankCompetitors(summaries, lastPrice)
  const ranks = new Map(leaderboard.ranked.map((r) => [r.competitor.address, r.rank!]))
  const paths = useRacePaths(summaries, prices)
  const viewMarket = markets.find((m) => m.id === viewId) ?? market
  // A second feed only while the market scene shows a token other than the competition's.
  const otherView = scene === 'market' && viewMarket && viewMarket.id !== market?.id ? viewMarket : undefined
  const { points: otherPrices } = usePriceHistory(otherView?.chartSymbol, otherView?.id)
  const viewPrices = otherView ? otherPrices : prices

  const elapsed = useElapsed()
  const phase = phaseAt(elapsed)
  // The card shows the current phase; before the start the first, after the bell the last (so P always works).
  const cardPhase = phase ?? (elapsed < 0 ? WINDOWS[0]! : WINDOWS[WINDOWS.length - 1]!)

  // Scene switches go through the strip wipe (yui540 #20): swap underneath once the strips cover the stage.
  const [wipe, setWipe] = useState(0)
  const wipeTimer = useRef<number>(0)
  const switchScene = (next: Scene) => {
    if (next === scene && !wipe) return
    window.clearTimeout(wipeTimer.current)
    setWipe((n) => n + 1)
    wipeTimer.current = window.setTimeout(() => {
      setScene(next)
      wipeTimer.current = window.setTimeout(() => setWipe(0), WIPE_COVER_MS + 900)
    }, WIPE_COVER_MS)
  }

  // Phase card for a few seconds whenever the phase changes (not on page load).
  const [cardUntil, setCardUntil] = useState(0)
  const prevPhase = useRef<number | null | undefined>(undefined)
  useEffect(() => {
    const idx = phase?.index ?? null
    if (prevPhase.current !== undefined && idx !== null && idx !== prevPhase.current) setCardUntil(Date.now() + PHASE_CARD_MS)
    prevPhase.current = idx
  }, [phase?.index])

  const upcoming = WINDOWS.find((w) => w.phase.countdown && w.startSec - elapsed > 0 && w.startSec - elapsed <= 10)

  // Liquidation screen for every new liquidation fill; ones already there at load are not replayed.
  // Each screen gets a `seq` so its 7 s timer runs once, however many arrive behind it.
  const [liqQueue, setLiqQueue] = useState<(Liquidation & { seq: number })[]>([])
  const liqSeq = useRef(0)
  const enqueue = (items: Liquidation[]) =>
    setLiqQueue((q) => {
      const [head, ...rest] = q
      const added = items.map((l) => ({ ...l, seq: ++liqSeq.current }))
      // Keep the one on screen plus the newest 3, so a burst cannot hold the screen for a minute.
      return head ? [head, ...[...rest, ...added].slice(-MAX_LIQ_BACKLOG)] : added.slice(-MAX_LIQ_BACKLOG - 1)
    })
  const seen = useRef<Set<string> | null>(null)
  const allLiqs = (): Liquidation[] =>
    summaries.flatMap((s) =>
      s.fills.filter((f) => f.kind === 'liquidation').map((fill) => ({ competitor: s.competitor, fill, loss: netPnl(fill), market: marketLabel })),
    )
  useEffect(() => {
    if (summaries.length === 0) return
    const liqs = allLiqs()
    // Seed only from a clean load: if a trader failed, their past liquidations would replay on recovery.
    if (seen.current === null && summaries.some((s) => s.competitor.address && s.error)) return
    if (seen.current === null) {
      seen.current = new Set(liqs.map((l) => l.fill.id))
      return
    }
    const fresh = liqs.filter((l) => !seen.current!.has(l.fill.id))
    fresh.forEach((l) => seen.current!.add(l.fill.id))
    if (fresh.length) enqueue(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaries])
  useEffect(() => {
    if (!liqQueue[0]) return
    const id = setTimeout(() => setLiqQueue((q) => q.slice(1)), LIQ_SCREEN_MS)
    return () => clearTimeout(id)
  }, [liqQueue[0]?.seq])

  // Lead change: キキーッ + 首位交代 (yui540 #24). Not on page load; see LEAD_HOLD_MS / LEAD_CAPTION_GAP_MS.
  const leader = leaderboard.ranked[0]?.competitor
  const [leadCaption, setLeadCaption] = useState<{ name: string; n: number } | null>(null)
  const announced = useRef<string | null>(null) // the leader the audience was last told about
  const candidate = useRef<{ address: string; since: number } | null>(null)
  const lastCaption = useRef(0)
  const captionSeq = useRef(0)
  const showLead = (name: string) => {
    lastCaption.current = Date.now()
    setLeadCaption({ name, n: ++captionSeq.current })
  }
  useEffect(() => {
    const a = leader?.address
    if (!a) return
    if (announced.current === null) {
      announced.current = a // first leader after load: no caption
      return
    }
    if (a === announced.current) {
      candidate.current = null
      return
    }
    if (candidate.current?.address !== a) candidate.current = { address: a, since: Date.now() }
    const held = Date.now() - candidate.current.since >= LEAD_HOLD_MS
    if (held && Date.now() - lastCaption.current >= LEAD_CAPTION_GAP_MS) {
      announced.current = a
      candidate.current = null
      showLead(leader!.name)
    }
    // re-checked every clock tick so a held lead gets announced without another reorder
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leader?.address, elapsed])
  useEffect(() => {
    if (!leadCaption) return
    const id = setTimeout(() => setLeadCaption(null), LEAD_CAPTION_MS)
    return () => clearTimeout(id)
  }, [leadCaption?.n])

  // Heart burst on a trader's race tag when they close a winning trade (yui540 #7); old wins are not replayed.
  const [bursts, setBursts] = useState(new Map<string, string>())
  const seenWins = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (summaries.length === 0) return
    const wins = summaries.flatMap((s) => s.fills.filter((f) => f.kind === 'close' && netPnl(f) > 0).map((f) => [s.competitor.address, f.id] as const))
    if (seenWins.current === null && summaries.some((s) => s.competitor.address && s.error)) return
    if (seenWins.current === null) {
      seenWins.current = new Set(wins.map(([, id]) => id))
      return
    }
    const fresh = wins.filter(([, id]) => !seenWins.current!.has(id))
    if (!fresh.length) return
    fresh.forEach(([, id]) => seenWins.current!.add(id))
    setBursts((m) => {
      const next = new Map(m)
      for (const [address, id] of fresh) next.set(address, id)
      return next
    })
  }, [summaries])

  // SHOT O'CLOCK only when the producer calls it (S key or the panel button); numbered per page session.
  const [shot, setShot] = useState<{ n: number; until: number } | null>(null)
  const shotCount = useRef(0)

  // Drinking wheel (W): picks a registered trader and a challenge; closes itself after the result.
  // The player list is frozen at roll time so a rank change mid-spin cannot move the slices.
  const [wheel, setWheel] = useState<{ seq: number; players: Competitor[]; pick: { player: number; challenge: number } } | null>(null)
  const players = leaderboard.ranked.map((r) => r.competitor)
  useEffect(() => {
    if (!wheel) return
    const id = setTimeout(() => setWheel(null), WHEEL_TOTAL_MS)
    return () => clearTimeout(id)
  }, [wheel?.seq])

  // Producer health: what would quietly go wrong in real mode.
  const priceAge = observedAt === null ? null : Math.round(Date.now() / 1000 - observedAt)
  const registered = summaries.filter((s) => s.competitor.address)
  const failing = registered.filter((s) => s.error)
  const health = [
    { label: MOCK ? 'MOCK DATA' : 'LIVE API', ok: true },
    { label: configError ? `CONFIG: ${configError} (retrying)` : market ? `MARKET ${marketLabel}` : 'CONFIG LOADING', ok: !configError && !!market },
    { label: COMPETITORS_CONFIGURED || MOCK ? `COMPETITORS ${COMPETITORS.filter((c) => c.address).length}` : 'COMPETITORS NOT SET: showing placeholder wallets (set VITE_COMPETITORS)', ok: COMPETITORS_CONFIGURED || MOCK },
    { label: START_CONFIGURED || MOCK ? 'START SET' : 'START NOT SET: a reload restarts the clock (set VITE_COMPETITION_START)', ok: START_CONFIGURED || MOCK },
    { label: priceAge === null ? 'PRICE: none yet' : `PRICE ${priceAge}s old${priceAge > STALE_PRICE_S ? ' STALE' : ''}`, ok: priceAge !== null && priceAge <= STALE_PRICE_S },
    {
      label: failing.length ? `TRADERS ${registered.length - failing.length}/${registered.length}: ${failing.map((f) => `${f.competitor.name} (${f.error})`).join(', ')}` : `TRADERS ${registered.length}/${registered.length}`,
      ok: failing.length === 0 && registered.length > 0,
    },
  ]

  // After the bell: final results, frozen at 60:00. E toggles it (also previews it mid-event).
  const ended = elapsed >= DURATION_SEC
  const [winnerToggle, setWinnerToggle] = useState<boolean | null>(null) // null = follow the clock
  const showWinner = winnerToggle ?? ended
  const standings = finalStandings(paths)

  // Producer keys: 1-4 scenes, P phase card, C countdown preview, A versus attack, S shot, W drinking wheel, E final results, [ ] token on the market scene, K lead-change caption, H heart burst on the leader, L replay the latest liquidation, Esc dismiss it, B brainrot panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Cmd/Ctrl/Alt shortcuts (Cmd+W, Cmd+C, Cmd+R…) belong to the browser, and a held key must not re-fire.
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const i = Number(e.key) - 1
      if (SCENES[i]) switchScene(SCENES[i])
      if (e.key === 'b') setBrainrot((v) => !v)
      if (e.key === 'c') setPreviewUntil(Date.now() + 10_000)
      if (e.key === 'e') setWinnerToggle(!showWinner)
      if (e.key === 'a') setAttackPreview((n) => n + 1)
      if (e.key === 'w' && players.length) setWheel((w) => ({ seq: (w?.seq ?? 0) + 1, players, pick: rollWheel(players) }))
      if (e.key === 's') setShot({ n: ++shotCount.current, until: Date.now() + SHOT_MS })
      if ((e.key === '[' || e.key === ']') && markets.length) {
        const i = Math.max(0, markets.findIndex((m) => m.id === viewMarket?.id))
        setViewId(markets[(i + (e.key === ']' ? 1 : markets.length - 1)) % markets.length]!.id)
      }
      if (e.key === 'k' && leader) showLead(leader.name)
      if (e.key === 'h' && leader) setBursts((m) => new Map(m).set(leader.address, `preview-${Date.now()}`))
      if (e.key === 'p') setCardUntil(Date.now() + PHASE_CARD_MS)
      if (e.key === 'l') {
        const latest = allLiqs().sort((a, b) => Date.parse(b.fill.occurredAt) - Date.parse(a.fill.occurredAt))[0]
        if (latest) enqueue([latest])
      }
      if (e.key === 'Escape') setLiqQueue((q) => q.slice(1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // C previews the countdown for the next phase that has one (10 s).
  const [previewUntil, setPreviewUntil] = useState(0)
  const previewLeft = Math.ceil((previewUntil - Date.now()) / 1000)
  const previewPhase = WINDOWS.find((w) => w.phase.countdown && w.startSec > elapsed) ?? WINDOWS.find((w) => w.phase.countdown)
  const countdown = upcoming ? { next: upcoming, seconds: upcoming.startSec - elapsed } : previewLeft > 0 && previewPhase ? { next: previewPhase, seconds: previewLeft } : null

  return (
    <>
      <Stage width={1920} height={1080}>
        <div className="flex h-full">
          <div className="relative min-w-0 flex-1">
            <Header elapsed={elapsed} phase={phase} />
            <section className="absolute inset-0 pt-28">
              {scene === 'race' && <RaceChart paths={paths} ranks={ranks} elapsed={elapsed} bursts={bursts} />}
              {scene === 'board' && <BoardScene leaderboard={leaderboard} market={marketLabel} />}
              {scene === 'versus' && <VersusScene leaderboard={leaderboard} market={marketLabel} preview={attackPreview} />}
              {scene === 'market' && viewMarket && (
                <MarketScene markets={markets} view={viewMarket} points={viewPrices} summaries={summaries} />
              )}
            </section>
            {/* Boost: a scrolling band along the bottom (yui540 #10). */}
            {phase?.phase.hot && (
              <ScrollBand text={`${phase.phase.badge} ▶`} className="absolute inset-x-0 bottom-0 z-20 py-3 text-5xl"
                style={{ background: PRIMARY, color: ON_PRIMARY }} />
            )}
          </div>
          {brainrot && <BrainrotPanel />}
        </div>
        {Date.now() < cardUntil && <PhaseCard phase={cardPhase} />}
        {showWinner && <WinnerScreen standings={standings} />}
        {wheel && <WheelScreen key={wheel.seq} players={wheel.players} pick={wheel.pick} />}
        {shot && Date.now() < shot.until && <ShotScreen key={`${shot.n}:${shot.until}`} n={shot.n} />}
        {leadCaption && <LeadChange key={leadCaption.n} name={leadCaption.name} />}
        {countdown && <Countdown next={countdown.next} seconds={countdown.seconds} />}
        {liqQueue[0] && <LiquidatedScreen key={liqQueue[0].seq} liq={liqQueue[0]} holdMs={LIQ_HOLD_MS} />}
        {wipe > 0 && <StripWipe key={wipe} />}
      </Stage>

      <nav className={`fixed bottom-3 right-4 z-50 flex flex-col items-end gap-1 text-xs transition-opacity hover:opacity-100 ${PRODUCER ? '' : 'opacity-0'}`}>
        {/* Health for the operator: hover, or always with ?producer (keep the OBS tab without it). */}
        <div className="flex max-w-[900px] flex-wrap justify-end gap-2 rounded bg-black/85 px-3 py-1.5 font-mono text-[11px] text-neutral-300">
          {health.map((h) => (
            <span key={h.label} className={h.ok ? 'text-emerald-400' : 'text-red-400'}>
              {h.ok ? '●' : '▲'} {h.label}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
        {SCENES.map((s, i) => (
          <button key={s} onClick={() => switchScene(s)} className={`rounded px-2 py-1 ${s === scene ? 'bg-white text-black' : 'bg-[#222] text-neutral-300'}`}>
            {i + 1} {s}
          </button>
        ))}
        {(
          [
            ['p', 'P phase'],
            ['c', 'C countdown'],
            ['[', '[ token'],
            [']', 'token ]'],
            ['k', 'K lead'],
            ['a', 'A attack'],
            ['s', 'S shot'],
            ['w', 'W wheel'],
            ['e', 'E results'],
            ['h', 'H heart'],
            ['l', 'L liq'],
            ['b', 'B brainrot'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key }))} className="rounded bg-[#222] px-2 py-1 text-neutral-300">
            {label}
          </button>
        ))}
        </div>
      </nav>
    </>
  )
}
