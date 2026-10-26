/**
 * Vertical 9:16 side panel looping a gameplay clip (Subway Surfers style) for the audience.
 * Drop the clip at public/brainrot.mp4, or set VITE_BRAINROT_URL. Toggle with B or ?brainrot.
 */
import { useState } from 'react'

const SRC = (import.meta.env.VITE_BRAINROT_URL as string | undefined) ?? '/brainrot.mp4'

export function BrainrotPanel() {
  const [failed, setFailed] = useState(false)
  return (
    <aside className="relative aspect-[9/16] h-full shrink-0 overflow-hidden border-l border-[#1c1c1c] bg-[#0a0a0a]">
      {failed ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-neutral-500">
          <div className="text-4xl font-bold text-neutral-300">brainrot.mp4</div>
          <div className="text-xl">Drop a vertical gameplay clip at public/brainrot.mp4</div>
        </div>
      ) : (
        <video src={SRC} className="h-full w-full object-cover" autoPlay muted loop playsInline onError={() => setFailed(true)} />
      )}
    </aside>
  )
}
