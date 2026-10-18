/**
 * Chart markers: what the indexer will feed the chart later.
 *
 * Mirrors what zenex-trade draws for open positions (useChartPositionMarkers.ts): an
 * entry dot at (time, price) and a dashed entry line labelled "Long 5x". Closes and
 * liquidations get their own shapes so the competition replay can show the whole life
 * of a position.
 */
export type MarkerKind = 'open' | 'close' | 'liquidation'

export interface ChartMarker {
  /** Stable id so updates replace rather than duplicate. */
  id: string
  /** Unix seconds of the fill. */
  time: number
  /** Fill price in natural units (e.g. 0.1766 for XLM/USD). */
  price: number
  side: 'long' | 'short'
  kind: MarkerKind
  /** Shown next to the marker, e.g. "Long 5x" or "ben". */
  label?: string
  /** Draw a horizontal entry line at `price` while the position is open. */
  entryLine?: boolean
}
