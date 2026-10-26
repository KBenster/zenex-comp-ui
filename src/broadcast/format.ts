import { COMPETITORS, type Competitor } from '@/competition/whitelist'

/** +$14,554 / -$434.24: cents only under $1,000, like a broadcast ticker. */
export function money(v: number): string {
  const abs = Math.abs(v)
  const digits = abs < 1000 ? 2 : 0
  return `${v < 0 ? '-' : '+'}$${abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

const PALETTE = ['#ffffff', '#f5d77a', '#d48cf2', '#6ee7f2', '#fb923c', '#86efac']
/** Stable per trader: their slot in the whitelist. */
export const traderColor = (c: Competitor) => PALETTE[Math.max(0, COMPETITORS.findIndex((x) => x.name === c.name)) % PALETTE.length]!

export const PROFIT = '#c8f26b'
export const LOSS = '#f05252'

/**
 * Two looks: `luma` (default) matches the event poster, green + lime with pixel lettering;
 * `classic` is the red + yellow Japanese-TV look (?theme=classic). DANGER stays red in both:
 * it is reserved for losses and the liquidation screen.
 */
const THEMES = {
  luma: { primary: '#24d38c', accent: '#dbff3c', onPrimary: '#000' },
  classic: { primary: '#ff2a4d', accent: '#ffd60a', onPrimary: '#fff' },
}
const themeName = new URLSearchParams(window.location.search).get('theme') === 'classic' ? 'classic' : 'luma'
// index.css switches the display font and background tint on this attribute.
document.documentElement.dataset.theme = themeName
const THEME = THEMES[themeName]

export const PRIMARY = THEME.primary
export const ACCENT = THEME.accent
/** Text colour on a PRIMARY block. */
export const ON_PRIMARY = THEME.onPrimary
export const DANGER = '#ff2a4d'
/** 1位 gold, 2位 silver, 3位 bronze. */
export const RANK_COLOR: Record<number, string> = { 1: ACCENT, 2: '#e4e4e7', 3: '#f0a35e' }
export const sideLabel = (side: 'long' | 'short') => (side === 'long' ? 'LONG' : 'SHORT')
/** 1ST, 2ND, 3RD, 4TH … */
export const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'ST' : n % 10 === 2 && n % 100 !== 12 ? 'ND' : n % 10 === 3 && n % 100 !== 13 ? 'RD' : 'TH'}`
