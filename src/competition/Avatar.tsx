import { useState } from 'react'
import { initials, type Competitor } from './whitelist'

/** Round profile picture from public/avatars, with initials when the file is missing or fails to load. */
export function Avatar({ competitor, size = 32, square = false }: { competitor: Competitor; size?: number; square?: boolean }) {
  const shape = square ? 'rounded-md' : 'rounded-full'
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) }
  if (!competitor.avatar || failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center ${shape} bg-[#2a2d36] font-semibold text-neutral-200`}
        style={style}
        title={competitor.name}
      >
        {initials(competitor.name)}
      </span>
    )
  }
  return (
    <img
      src={competitor.avatar}
      alt={competitor.name}
      className={`shrink-0 ${shape} object-cover`}
      style={style}
      onError={() => setFailed(true)}
    />
  )
}
