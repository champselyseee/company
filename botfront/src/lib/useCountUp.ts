import { useEffect, useRef, useState } from 'react'

/* Плавно «докручивает» число до target за duration мс.
   Считает от ТЕКУЩЕГО значения, а не с нуля: иначе при смене target (например,
   витринное 12480 сменилось живым числом из БД) плитка на глазах падала в 0
   и пересчитывалась заново.
   При prefers-reduced-motion сразу показывает финал (без анимации). */
export function useCountUp(target: number, duration = 900, enabled = true): number {
  const [value, setValue] = useState(enabled ? 0 : target)
  const frame = useRef<number>(0)
  // Значение, от которого стартует текущая анимация (и её текущий кадр).
  const from = useRef(enabled ? 0 : target)

  useEffect(() => {
    if (!enabled) {
      from.current = target
      setValue(target)
      return
    }
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      from.current = target
      setValue(target)
      return
    }

    const start = performance.now()
    const begin = from.current
    const ease = (t: number) => 1 - Math.pow(1 - t, 3) // easeOutCubic

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const v = Math.round(begin + (target - begin) * ease(p))
      from.current = v
      setValue(v)
      if (p < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [target, duration, enabled])

  return value
}
