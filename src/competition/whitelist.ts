/**
 * Competitors: the only accounts whose fills and positions the UI shows.
 *
 * Six people, so this is a static list, no backend. To add someone:
 *   1. drop their picture in `public/avatars/<handle>.png` (or .jpg/.svg, square, ~256px),
 *   2. fill in their Stellar address (G… classic account or C… smart account, as Zenex's API shows it),
 *   3. set `name` to the username shown on the chart and the panel.
 * An entry with an empty address is listed in the panel but nothing is fetched for it.
 *
 * The two filled-in addresses are testnet traders from the public leaderboard, so the feed has
 * something to render in development. Replace them.
 */
export interface Competitor {
  /** Stellar address, or '' while unknown. */
  address: string
  /** Username shown on markers and in the panel. */
  name: string
  /** Path under public/, e.g. '/avatars/ben.png'. Falls back to initials when missing or broken. */
  avatar?: string
}

/** Checked-in default, used when VITE_COMPETITORS is not set. */
export const DEFAULT_COMPETITORS: Competitor[] = [
  { address: 'CBJTN2SYYZCEGESQMBY3XRE3D622BIL3TKG3Z4D3VOTID5A7HUPEN3IN', name: 'ben', avatar: '/avatars/ben.svg' },
  { address: 'CDMKJHYT2K24W74FPSVO5IAQMAOMDG4OOWYRPVUGNDDIBWCTUKUZWSY2', name: 'player2', avatar: '/avatars/player2.svg' },
  { address: '', name: 'player3', avatar: '/avatars/player3.svg' },
  { address: '', name: 'player4', avatar: '/avatars/player4.svg' },
  { address: '', name: 'player5', avatar: '/avatars/player5.svg' },
  { address: '', name: 'player6', avatar: '/avatars/player6.svg' },
]

/**
 * Deploy-time override: set `VITE_COMPETITORS` (Vercel: Project → Settings → Environment Variables)
 * to a JSON array of `{ "address", "name", "avatar" }`. `avatar` may be a full URL (a Discord or
 * X profile picture, anything public) or a path under public/. Vite inlines the variable at build
 * time, so changing it means redeploying, which on Vercel is one click. A malformed value is
 * reported in the console and the checked-in default is used instead.
 */
export function parseCompetitors(raw: string | undefined, fallback: Competitor[] = DEFAULT_COMPETITORS): Competitor[] {
  if (!raw || raw.trim() === '') return fallback
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('not an array')
    return parsed.map((entry, i) => {
      if (typeof entry !== 'object' || entry === null) throw new Error(`entry ${i} is not an object`)
      const e = entry as Record<string, unknown>
      if (typeof e.name !== 'string' || e.name.trim() === '') throw new Error(`entry ${i} has no name`)
      if (e.address !== undefined && typeof e.address !== 'string') throw new Error(`entry ${i} address must be a string`)
      if (e.avatar !== undefined && typeof e.avatar !== 'string') throw new Error(`entry ${i} avatar must be a string`)
      return { address: (e.address as string | undefined)?.trim() ?? '', name: e.name.trim(), avatar: e.avatar as string | undefined }
    })
  } catch (error) {
    console.error(`VITE_COMPETITORS ignored: ${String((error as Error).message ?? error)}`)
    return fallback
  }
}

export const COMPETITORS: Competitor[] = parseCompetitors(import.meta.env.VITE_COMPETITORS as string | undefined)

export function shortAddress(address: string): string {
  return address ? `${address.slice(0, 4)}…${address.slice(-4)}` : 'address not set'
}

export function initials(name: string): string {
  return name
    .split(/[\s_-]+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
