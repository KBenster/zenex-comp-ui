/**
 * Candlestick chart for one Zenex market, drawn with TradingView Lightweight Charts.
 *
 * Data path is the same one zenex-trade's TradingView widget uses: history from the backend's
 * UDF proxy, the forming bar advanced at 1 Hz from /v1/prices/tickers. Scrolling left pages
 * older history in. `markers` are drawn as series markers plus optional entry price lines.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { fetchHistory, fetchTickers, resolutionSeconds, PRICE_SCALE, type Bar, type Resolution } from '@/lib/zenexApi'
import type { ChartMarker } from './markers'

const theme = {
  surface: '#18191b',
  grid: '#232428',
  text: '#b0b4ba',
  textFaint: '#6b7079',
  green: '#22c55e',
  red: '#ef4444',
  crosshair: '#9ca3af',
}

/** How many bars to load initially and per back-page. */
const INITIAL_BARS = 300
const PAGE_BARS = 300

/** Earliest bar Chainlink has for Zenex's streams (zenex-trade priceHubUdfClient). */
const HISTORY_FLOOR_SECONDS = 1_731_196_800

function priceDecimals(sample: number): number {
  if (sample >= 1000) return 2
  if (sample >= 10) return 3
  if (sample >= 1) return 4
  return 5
}

function toCandle(bar: Bar): CandlestickData<UTCTimestamp> {
  return { time: bar.time as UTCTimestamp, open: bar.open, high: bar.high, low: bar.low, close: bar.close }
}

interface PriceChartProps {
  chartSymbol: string
  marketId: string
  resolution: Resolution
  markers?: readonly ChartMarker[]
  onLastPrice?: (price: number, observationsTimestamp: number) => void
  className?: string
}

export function PriceChart({ chartSymbol, marketId, resolution, markers = [], onLastPrice, className }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const priceLinesRef = useRef<IPriceLine[]>([])
  const barsRef = useRef<Bar[]>([])
  const onLastPriceRef = useRef(onLastPrice)
  onLastPriceRef.current = onLastPrice
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  // Chart + series, once per mount.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: theme.surface },
        textColor: theme.text,
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        attributionLogo: true,
      },
      grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: theme.crosshair, labelBackgroundColor: '#2a2d36' },
        horzLine: { color: theme.crosshair, labelBackgroundColor: '#2a2d36' },
      },
      rightPriceScale: { borderColor: theme.grid },
      timeScale: { borderColor: theme.grid, timeVisible: true, secondsVisible: false, rightOffset: 6 },
      localization: { locale: 'en-US' },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: theme.green,
      downColor: theme.red,
      borderUpColor: theme.green,
      borderDownColor: theme.red,
      wickUpColor: theme.green,
      wickDownColor: theme.red,
    })
    chartRef.current = chart
    seriesRef.current = series
    markersPluginRef.current = createSeriesMarkers(series, [])
    return () => {
      markersPluginRef.current?.detach()
      markersPluginRef.current = null
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // History load, back-paging and the 1 Hz live tail, per symbol/resolution.
  useEffect(() => {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return
    let cancelled = false
    let paging = false
    let reachedFloor = false
    const period = resolutionSeconds(resolution)
    barsRef.current = []
    series.setData([])
    setStatus('loading')
    setError(null)

    const applyBars = (bars: Bar[]) => {
      barsRef.current = bars
      series.setData(bars.map(toCandle))
      if (bars.length > 0) {
        const decimals = priceDecimals(bars[bars.length - 1]!.close)
        series.applyOptions({ priceFormat: { type: 'price', precision: decimals, minMove: 10 ** -decimals } })
      }
    }

    // The backend is a Cloudflare Worker in front of Chainlink's candle API; a single 5xx or a
    // dropped proxy connection is routine, so keep retrying with backoff until bars arrive.
    const loadInitial = async () => {
      let attempt = 0
      while (!cancelled) {
        const now = Math.floor(Date.now() / 1000)
        try {
          const bars = await fetchHistory(chartSymbol, resolution, now - INITIAL_BARS * period, now)
          if (cancelled) return
          applyBars(bars)
          chart.timeScale().fitContent()
          setStatus('ready')
          setError(null)
          return
        } catch (e) {
          if (cancelled) return
          attempt += 1
          const delayMs = Math.min(1_000 * 2 ** (attempt - 1), 15_000)
          setStatus('error')
          setError(`${String((e as Error).message ?? e)} (retrying in ${Math.round(delayMs / 1000)} s)`)
          await new Promise((resolve) => window.setTimeout(resolve, delayMs))
        }
      }
    }

    const pageBack = async () => {
      if (paging || reachedFloor || barsRef.current.length === 0) return
      paging = true
      try {
        const oldest = barsRef.current[0]!.time
        const from = Math.max(oldest - PAGE_BARS * period, HISTORY_FLOOR_SECONDS)
        if (from >= oldest - period) {
          reachedFloor = true
          return
        }
        const older = await fetchHistory(chartSymbol, resolution, from, oldest - 1)
        if (cancelled) return
        if (older.length === 0) {
          reachedFloor = from <= HISTORY_FLOOR_SECONDS
          return
        }
        const added = older.filter((b) => b.time < oldest)
        if (added.length === 0) return
        // setData re-indexes bars from 0, so without this shift the viewport would land on the
        // freshly prepended bars and immediately trigger the next page.
        const view = chart.timeScale().getVisibleLogicalRange()
        applyBars([...added, ...barsRef.current])
        if (view) {
          chart.timeScale().setVisibleLogicalRange({ from: view.from + added.length, to: view.to + added.length })
        }
      } catch {
        /* transient; the next scroll retries */
      } finally {
        paging = false
      }
    }

    const onRange = (range: { from: number; to: number } | null) => {
      // Only page when the user has actually scrolled to the left edge of loaded data.
      if (range && range.from < 10 && barsRef.current.length > 0) void pageBack()
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange)

    // Live tail: advance the forming bar from the 1 Hz ticker, open a new bar on period boundaries.
    const tick = async () => {
      try {
        const tickers = await fetchTickers()
        if (cancelled) return
        const t = tickers.find((x) => x.marketId === marketId)
        if (!t) return
        const price = Number(t.price) / PRICE_SCALE
        onLastPriceRef.current?.(price, t.observationsTimestamp)
        const bars = barsRef.current
        if (bars.length === 0) return
        const bucket = Math.floor(t.observationsTimestamp / period) * period
        const last = bars[bars.length - 1]!
        if (bucket > last.time) {
          const bar: Bar = { time: bucket, open: price, high: price, low: price, close: price }
          bars.push(bar)
          series.update(toCandle(bar))
        } else if (bucket === last.time) {
          last.high = Math.max(last.high, price)
          last.low = Math.min(last.low, price)
          last.close = price
          series.update(toCandle(last))
        }
      } catch {
        /* one missed tick is fine */
      }
    }

    // Reconcile the recent window against the backend's own bars every 30 s.
    const reconcile = async () => {
      try {
        const now = Math.floor(Date.now() / 1000)
        const recent = await fetchHistory(chartSymbol, resolution, now - 5 * period, now)
        if (cancelled || recent.length === 0) return
        const cut = recent[0]!.time
        const merged = [...barsRef.current.filter((b) => b.time < cut), ...recent]
        applyBars(merged)
      } catch {
        /* keep the local tail */
      }
    }

    void loadInitial()
    const tickTimer = window.setInterval(() => void tick(), 1_000)
    const reconcileTimer = window.setInterval(() => void reconcile(), 30_000)
    return () => {
      cancelled = true
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange)
      window.clearInterval(tickTimer)
      window.clearInterval(reconcileTimer)
    }
  }, [chartSymbol, marketId, resolution])

  // Markers: dots/arrows at the fill, plus dashed entry lines.
  const markerKey = useMemo(() => JSON.stringify(markers), [markers])
  useEffect(() => {
    const series = seriesRef.current
    const plugin = markersPluginRef.current
    if (!series || !plugin) return
    const seriesMarkers: SeriesMarker<UTCTimestamp>[] = [...markers]
      .sort((a, b) => a.time - b.time)
      .map((m) => {
        const color = m.kind === 'liquidation' ? '#f59e0b' : m.side === 'long' ? theme.green : theme.red
        const shape = m.kind === 'open' ? 'circle' : m.kind === 'close' ? 'square' : 'arrowDown'
        return {
          time: m.time as UTCTimestamp,
          position: m.side === 'long' ? 'belowBar' : 'aboveBar',
          color,
          shape,
          size: m.kind === 'open' ? 1 : 1.2,
          text: m.label ?? (m.kind === 'liquidation' ? 'LIQ' : undefined),
        }
      })
    plugin.setMarkers(seriesMarkers)

    for (const line of priceLinesRef.current) series.removePriceLine(line)
    priceLinesRef.current = markers
      .filter((m) => m.entryLine)
      .map((m) =>
        series.createPriceLine({
          price: m.price,
          color: m.side === 'long' ? theme.green : theme.red,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: m.label ?? (m.side === 'long' ? 'Long' : 'Short'),
        }),
      )
    // markerKey captures the content; markers itself may be a fresh array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerKey])

  return (
    <div className={`relative h-full w-full ${className ?? ''}`} style={{ background: theme.surface }}>
      <div ref={containerRef} className="h-full w-full" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: theme.textFaint }}>
          Loading {chartSymbol} candles
        </div>
      )}
      {status === 'error' && (
        <div className="absolute left-3 top-3 z-10 rounded-sm border border-red-500/40 bg-[#18191b]/95 px-3 py-2 text-xs text-red-400">
          Chart data unavailable: {error}
        </div>
      )}
    </div>
  )
}
