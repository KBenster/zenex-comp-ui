/** Live streaming line of one market's price (Bklit UI LiveLineChart). Points come from usePriceHistory. */
import { LiveLineChart } from '@/components/charts/live-line-chart'
import { LiveLine } from '@/components/charts/live-line'
import { LiveXAxis } from '@/components/charts/live-x-axis'
import { LiveYAxis } from '@/components/charts/live-y-axis'
import type { PricePoint } from '@/competition/useRace'

const momentumColors = { up: '#22c55e', down: '#ef4444', flat: '#a1a1aa' }

/** Decimals by magnitude: BTC 96,012.34, SOL 190.123, XLM 0.17674. */
export function formatPrice(v: number): string {
  const d = v >= 1000 ? 2 : v >= 1 ? 3 : 5
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

/** The big price lives in the scene header, so the chart's own small badge is off. */
export function LivePriceChart({ points, window: windowSec = 120 }: { points: PricePoint[]; window?: number }) {
  if (points.length === 0) return <div className="flex h-full items-center justify-center text-3xl text-neutral-500">Connecting…</div>
  const data = points.map((p) => ({ time: p.t, value: p.price }))
  return (
    <LiveLineChart data={data} value={data[data.length - 1]!.value} window={windowSec} exaggerate style={{ height: '100%' }} className="zx-chart" margin={{ top: 16, right: 40, bottom: 56, left: 190 }}>
      <LiveLine dataKey="value" momentumColors={momentumColors} formatValue={formatPrice} badge={false} dotSize={7} />
      <LiveXAxis />
      <LiveYAxis position="left" formatValue={formatPrice} />
    </LiveLineChart>
  )
}
