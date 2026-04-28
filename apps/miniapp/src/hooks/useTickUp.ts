// Анимирует целое число от 0 до target за durationMs через requestAnimationFrame
// с easeOutCubic. Используется в ResultScreen, чтобы счёт «накручивался» а не
// показывался моментально — после долгой партии это ощутимый момент награды.

import { useEffect, useState } from 'react'

export function useTickUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (target <= 0) {
      setValue(0)
      return
    }
    if (typeof window === 'undefined' || !('requestAnimationFrame' in window)) {
      setValue(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])

  return value
}
