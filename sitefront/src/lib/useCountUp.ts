import { useEffect, useRef, useState } from 'react'

/* Плавно «докручивает» число от from (по умолчанию 0) до target за duration мс.
   При prefers-reduced-motion сразу показывает финал (без анимации). */
export function useCountUp(target: number, duration = 900, enabled = true, from = 0): number {
  const [value, setValue] = useState(enabled ? from : target)
  const frame = useRef<number>(0)

  useEffect(() => {
    if (!enabled) {
      setValue(target)
      return
    }
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setValue(target)
      return
    }

    const start = performance.now()
    const ease = (t: number) => 1 - Math.pow(1 - t, 3) // easeOutCubic

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setValue(Math.round(from + (target - from) * ease(p)))
      if (p < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [target, duration, enabled, from])

  return value
}
