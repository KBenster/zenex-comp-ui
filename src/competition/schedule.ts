/**
 * Competition clock and phases. Edit PHASES to change the run of show.
 * Start time: VITE_COMPETITION_START (ISO, e.g. 2026-11-01T18:00:00Z); in mock mode, 8 minutes before page load;
 * otherwise page load.
 */
import { useEffect, useState } from 'react'
import { MOCK, MOCK_START } from '@/lib/mock'

export interface Phase {
  /** Short name on the phase timeline. */
  name: string
  minutes: number
  /** Badge next to the LIVE clock, e.g. "BUILD TIME". */
  badge: string
  /** Big Japanese title on the phase card (the one place a phase shows Japanese). */
  jpTitle: string
  /** Big text on the phase card. */
  title: string
  subtitle?: string
  /** Shaded band on the race chart with this label. */
  band?: string
  /** 10 s countdown before this phase starts; `detail` is the line under the number. */
  countdown?: { label: string; detail: string }
  /** Red accent (boost). */
  hot?: boolean
}

/**
 * Run of show for a 60-minute power hour (phases start on whole minutes):
 *   0:00 Build · 10:00 Hot 1 · 15:00 Build · 25:00 Hot 2 · 30:00 Final · 50:00 Boost · 60:00 bell
 * Countdowns run the 10 s before Hot 1, Hot 2 and Boost; the phase card shows for 5 s at each start.
 */
export const PHASES: Phase[] = [
  { name: 'Build', minutes: 10, badge: 'BUILD TIME', jpTitle: 'ビルドタイム', title: 'Build', countdown: { label: 'POWER HOUR', detail: 'Trading opens at 0:00' } },
  { name: 'Hot 1', minutes: 5, badge: 'DONG HOT', jpTitle: 'ホットタイム', title: 'Hot 1', subtitle: 'DONG', band: 'DONG HOT', countdown: { label: 'DONG HOT', detail: 'DONG is the only market that counts' } },
  { name: 'Build', minutes: 10, badge: 'BUILD TIME', jpTitle: 'ビルドタイム', title: 'Build' },
  { name: 'Hot 2', minutes: 5, badge: 'DONG HOT', jpTitle: 'ホットタイム', title: 'Hot 2', subtitle: 'DONG', band: 'DONG HOT', countdown: { label: 'DONG HOT', detail: 'DONG is the only market that counts' } },
  { name: 'Final', minutes: 20, badge: 'FINAL', jpTitle: 'ファイナル', title: 'Final' },
  { name: 'Boost', minutes: 10, badge: '500X BOOST', jpTitle: '500倍ブースト', title: '500x', subtitle: 'Boost', hot: true, countdown: { label: '500X BOOST', detail: 'Max leverage for everyone, until the bell' } },
]

export const DURATION_SEC = PHASES.reduce((s, p) => s + p.minutes * 60, 0)

const envStart = import.meta.env.VITE_COMPETITION_START as string | undefined
/** True when the real start time is configured; without it a reload restarts the clock. */
export const START_CONFIGURED = Boolean(envStart)
export const START_SEC: number = envStart
  ? Date.parse(envStart) / 1000
  : MOCK
    ? MOCK_START
    : Math.floor(Date.now() / 1000)

export interface PhaseWindow {
  index: number
  phase: Phase
  startSec: number
  endSec: number
}

/** Phase windows in seconds since start. */
export const WINDOWS: PhaseWindow[] = PHASES.reduce<PhaseWindow[]>((acc, phase, index) => {
  const startSec = acc.length ? acc[acc.length - 1]!.endSec : 0
  acc.push({ index, phase, startSec, endSec: startSec + phase.minutes * 60 })
  return acc
}, [])

/** Current phase, or null before the start / after the bell. */
export function phaseAt(elapsed: number): PhaseWindow | null {
  return WINDOWS.find((w) => elapsed >= w.startSec && elapsed < w.endSec) ?? null
}

/** Seconds since start, ticking every second. */
export function useElapsed(): number {
  const [now, setNow] = useState(() => Date.now() / 1000)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 1_000)
    return () => clearInterval(id)
  }, [])
  return Math.floor(now - START_SEC)
}

export const clock = (sec: number) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.floor(Math.max(0, sec) % 60)).padStart(2, '0')}`
