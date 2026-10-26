/**
 * PnL race on Bklit's LiveLineChart: one LiveLine per trader, the window grows with the event so
 * the whole race stays on screen, avatar + rank + name + PnL at each tip, hot phases shaded.
 */
import { createPortal } from 'react-dom'
import { useChart, useChartPortalContainer } from '@/components/charts/chart-context'
import { LiveLine } from '@/components/charts/live-line'
import { LiveLineChart } from '@/components/charts/live-line-chart'
import { LiveXAxis } from '@/components/charts/live-x-axis'
import { LiveYAxis } from '@/components/charts/live-y-axis'
import { Avatar } from '@/competition/Avatar'
import { START_SEC, WINDOWS, clock } from '@/competition/schedule'
import type { RacePath } from '@/competition/useRace'
import { ACCENT, LOSS, PROFIT, money, ordinal, traderColor } from './format'
import { HeartBurst } from './Motion'

const MIN_WINDOW = 120

interface Props {
  paths: RacePath[]
  ranks: Map<string, number>
  elapsed: number
  /** address -> id of the winning close to celebrate (yui540 #7 heart burst on the tag). */
  bursts: Map<string, string>
}

export function RaceChart({ paths, ranks, elapsed, bursts }: Props) {
  // One row per timestamp with every trader's PnL (carried forward), keyed by address.
  const times = [...new Set(paths.flatMap((p) => p.points.map(([t]) => t)))].sort((a, b) => a - b)
  const cursor = paths.map(() => 0)
  const last = paths.map(() => 0)
  const data = times.map((t) => {
    const row: Record<string, number> = { time: START_SEC + t }
    paths.forEach((p, i) => {
      while (cursor[i]! < p.points.length && p.points[cursor[i]!]![0] <= t) last[i] = p.points[cursor[i]!++]![1]
      row[p.summary.competitor.address] = last[i]!
    })
    return row
  })
  if (data.length < 2) return <div className="flex h-full items-center justify-center text-3xl text-neutral-500">WAITING FOR THE FIRST TRADES</div>
  const leader = paths.find((p) => ranks.get(p.summary.competitor.address) === 1)
  const value = leader ? data[data.length - 1]![leader.summary.competitor.address]! : 0

  return (
    <div className="zx-chart h-full px-6 pb-4">
      <LiveLineChart
        // Bklit types data as { time, value }; extra numeric keys are read by each LiveLine's dataKey.
        data={data as unknown as { time: number; value: number }[]}
        value={value}
        // nowOffsetUnits=1 keeps a quarter of the width free on the right for the labels, so stretch the window to keep 0:00 in view.
        window={Math.max(MIN_WINDOW, ((elapsed + 5) * 4) / 3)}
        nowOffsetUnits={1}
        style={{ height: '100%' }}
        margin={{ top: 24, right: 24, bottom: 56, left: 170 }}
      >
        <HotBands />
        <ZeroLine />
        {paths.map((p) => (
          <TraderLine key={p.summary.competitor.address} path={p} />
        ))}
        <TipLabels paths={paths} ranks={ranks} bursts={bursts} />
        <LiveXAxis formatTime={(ms) => clock(ms / 1000 - START_SEC)} />
        <LiveYAxis position="left" formatValue={(v) => money(v)} />
      </LiveLineChart>
    </div>
  )
}

// LiveLine recolours its dot by momentum by default; pin all three to the trader's colour.
function TraderLine({ path }: { path: RacePath }) {
  const c = traderColor(path.summary.competitor)
  return <LiveLine dataKey={path.summary.competitor.address} stroke={c} momentumColors={{ up: c, down: c, flat: c }} strokeWidth={2.5} fill={false} badge={false} dotSize={5} />
}

function HotBands() {
  const { xScale, innerHeight } = useChart()
  return (
    <g>
      {WINDOWS.filter((w) => w.phase.band).map((w) => {
        const x0 = xScale(new Date((START_SEC + w.startSec) * 1000)) ?? 0
        const x1 = xScale(new Date((START_SEC + w.endSec) * 1000)) ?? 0
        return (
          <g key={w.index}>
            <rect x={x0} y={0} width={Math.max(0, x1 - x0)} height={innerHeight} fill="#161616" />
            {[x0, x1].map((x) => (
              <line key={x} x1={x} x2={x} y1={0} y2={innerHeight} stroke="#3f3f46" strokeDasharray="4 4" />
            ))}
            <text x={x0 + 10} y={30} fill="#d4d4d8" fontSize={24} fontWeight={700} letterSpacing="0.04em">
              {w.phase.band}
            </text>
          </g>
        )
      })}
    </g>
  )
}
HotBands.displayName = 'HotBands'

function ZeroLine() {
  const { yScale, innerWidth } = useChart()
  const y = yScale(0) ?? 0
  return <line x1={0} x2={innerWidth} y1={y} y2={y} stroke="#3f3f46" />
}
ZeroLine.displayName = 'ZeroLine'

/** Slanted name tag (rank, name) in the trader's colour + outlined PnL next to each live dot, pushed apart so they never overlap. */
function TipLabels({ paths, ranks, bursts }: { paths: RacePath[]; ranks: Map<string, number>; bursts: Map<string, string> }) {
  const { data, xScale, yScale, xAccessor, margin, containerRef } = useChart()
  // HTML portal over the chart, not foreignObject: Chrome misplaces <img> inside foreignObject under the stage's CSS scale.
  const container = useChartPortalContainer(containerRef)
  // Same "now" point LiveLine puts its dot on.
  const now = data.length >= 2 ? data.at(-2) : data.at(-1)
  if (!now || !container) return null
  const gap = 90
  const x = margin.left + (xScale(xAccessor(now)) ?? 0) + 16
  const labels = paths
    .map((p) => {
      const v = now[p.summary.competitor.address] as number
      return { p, v, y: margin.top + (yScale(v) ?? 0) }
    })
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < labels.length; i++) labels[i]!.y = Math.max(labels[i]!.y, labels[i - 1]!.y + gap)

  return createPortal(
    <div className="pointer-events-none absolute inset-0">
      {labels.map(({ p, v, y }) => {
        const color = traderColor(p.summary.competitor)
        const rank = ranks.get(p.summary.competitor.address)
        return (
          <div key={p.summary.competitor.address} className="absolute flex items-center gap-2.5" style={{ left: x, top: y - gap / 2, height: gap }}>
              <span className="relative inline-block">
                <Avatar competitor={p.summary.competitor} size={56} square />
                {bursts.get(p.summary.competitor.address) && <HeartBurst key={bursts.get(p.summary.competitor.address)} />}
              </span>
              <div className="leading-none">
                <div className="-skew-x-12 inline-block px-3 py-1" style={{ background: color }}>
                  <div className="skew-x-12 whitespace-nowrap font-black text-black text-2xl">
                    <span className="font-display" style={{ color: rank === 1 ? '#b91c1c' : '#000' }}>{rank ? ordinal(rank) : ''}</span> {p.summary.competitor.name}
                  </div>
                </div>
                <div className="font-display telop mt-1 tabular-nums text-3xl" style={{ color: rank === 1 ? ACCENT : '#fff' }}>
                  {money(v)}
                  {/* Open position's leverage as a chip next to the PnL, e.g. "100x"; green long, red short. */}
                  {p.summary.openPositions[0] && (
                    <span
                      className="ml-3 inline-block -skew-x-12 px-3 py-0.5 align-middle text-3xl text-black"
                      style={{ background: p.summary.openPositions[0].side === 'long' ? PROFIT : LOSS, WebkitTextStroke: 0, textShadow: 'none' }}
                    >
                      <span className="inline-block skew-x-12">
                        {p.summary.openPositions[0].leverage.toFixed(0)}x
                      </span>
                    </span>
                  )}
                </div>
              </div>
          </div>
        )
      })}
    </div>,
    container,
  )
}
TipLabels.displayName = 'TipLabels'
