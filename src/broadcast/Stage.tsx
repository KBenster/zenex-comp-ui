/** Fixed-size broadcast canvas (1920x1080 or 1080x1920) scaled to fit the window, letterboxed. */
import { useEffect, useState, type ReactNode } from 'react'

export function Stage({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const fit = () => Math.min(window.innerWidth / width, window.innerHeight / height)
  const [scale, setScale] = useState(fit)
  useEffect(() => {
    const onResize = () => setScale(fit())
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height])
  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
      <div style={{ width: width * scale, height: height * scale }}>
        <div className="bg-stage relative overflow-hidden text-white" style={{ width, height, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
