import { useEffect, useState } from 'react'
import { PriceChart } from '@/chart/PriceChart'
import { CompetitorPanel } from '@/competition/CompetitorPanel'
import { Spotlight } from '@/competition/Spotlight'
import { rankCompetitors } from '@/competition/ranking'
import { useCompetitorActivity } from '@/competition/useCompetitorActivity'
import { COMPETITORS } from '@/competition/whitelist'
import { fetchConfig, RESOLUTIONS, type Resolution, type ZenexMarket } from '@/lib/zenexApi'

const RESOLUTION_LABEL: Record<Resolution, string> = { '1': '1m', '5': '5m', '15': '15m', '60': '1h', '240': '4h', '1D': '1D' }

function formatPrice(price: number): string {
  const decimals = price >= 1000 ? 2 : price >= 10 ? 3 : price >= 1 ? 4 : 5
  return price.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export default function App() {
  const [markets, setMarkets] = useState<ZenexMarket[]>([])
  const [marketId, setMarketId] = useState<string>('xlm-usd')
  const [resolution, setResolution] = useState<Resolution>('5')
  const [last, setLast] = useState<{ price: number; at: number } | null>(null)
  const [showMarkers, setShowMarkers] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    fetchConfig()
      .then((cfg) => {
        setMarkets(cfg.markets)
        if (!cfg.markets.some((m) => m.id === marketId) && cfg.markets[0]) setMarketId(cfg.markets[0].id)
      })
      .catch((e) => setConfigError(String((e as Error).message ?? e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const market = markets.find((m) => m.id === marketId)
  // Only the whitelisted competitors' fills and positions are fetched and drawn.
  const { summaries, markers } = useCompetitorActivity(COMPETITORS, market?.id)
  const leaderboard = rankCompetitors(summaries, last?.price ?? null)

  return (
    <main className="flex h-screen flex-col bg-[#101116] text-neutral-100">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#232428] px-4 py-2">
        <span className="text-sm font-semibold tracking-tight">zenex-comp-ui</span>
        <select
          className="rounded-sm border border-[#2a2d36] bg-[#18191b] px-2 py-1 text-sm"
          value={marketId}
          onChange={(e) => setMarketId(e.target.value)}
        >
          {markets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.chartSymbol.replace(/USD$/, '/USD')}
            </option>
          ))}
        </select>
        <span className="font-mono text-lg tabular-nums">{last ? formatPrice(last.price) : '…'}</span>
        {last && <span className="text-xs text-neutral-500">{new Date(last.at * 1000).toLocaleTimeString()}</span>}
        <div className="ml-auto flex items-center gap-1">
          {RESOLUTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setResolution(r)}
              className={`rounded-sm px-2 py-1 text-xs ${r === resolution ? 'bg-[#2a2d36] text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              {RESOLUTION_LABEL[r]}
            </button>
          ))}
          <label className="ml-3 flex items-center gap-1 text-xs text-neutral-400">
            <input type="checkbox" checked={showMarkers} onChange={(e) => setShowMarkers(e.target.checked)} />
            competitor fills ({markers.filter((m) => !m.entryLine).length})
          </label>
        </div>
      </header>
      <section className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            {configError && <div className="p-4 text-sm text-red-400">Config unavailable: {configError}</div>}
            {market && (
              <PriceChart
                chartSymbol={market.chartSymbol}
                marketId={market.id}
                resolution={resolution}
                markers={showMarkers ? markers : []}
                onLastPrice={(price, at) => setLast({ price, at })}
              />
            )}
          </div>
          <Spotlight leaderboard={leaderboard} />
        </div>
        <CompetitorPanel leaderboard={leaderboard} lastPrice={last?.price ?? null} />
      </section>
    </main>
  )
}
