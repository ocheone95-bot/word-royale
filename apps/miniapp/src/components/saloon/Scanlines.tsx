// CRT scanlines overlay. Применяется per-screen (Game/Result), не глобально.
// User-toggle через store/настройки можно повесить позже — пока просто
// флаг enabled: false по умолчанию для Home/Leaderboard.

import type { CSSProperties } from 'react'

interface ScanlinesProps {
  enabled?: boolean
  opacity?: number
  className?: string
  style?: CSSProperties
}

export function Scanlines({
  enabled = true,
  opacity = 0.1,
  className,
  style,
}: ScanlinesProps) {
  if (!enabled) return null
  const styles: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    backgroundImage: `repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,${opacity}) 2px, rgba(0,0,0,${opacity}) 3px)`,
    mixBlendMode: 'multiply',
    zIndex: 5,
    ...style,
  }
  return <div className={className} style={styles} />
}
