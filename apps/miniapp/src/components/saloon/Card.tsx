// Saloon-Card — карточка для shop/leaderboard/info блоков.
// Два варианта: table (тёмная сепия) и leather (поднятая, brown highlight).
// Опциональная brass border (33% opacity) + soft drop shadow.

import type { CSSProperties, ReactNode } from 'react'

type Surface = 'table' | 'leather'

interface CardProps {
  surface?: Surface
  bordered?: boolean
  padding?: number | string
  className?: string
  style?: CSSProperties
  children: ReactNode
}

const BG: Record<Surface, string> = {
  table: 'var(--gradient-card-table)',
  leather: 'var(--bg-leather)',
}

export function Card({
  surface = 'table',
  bordered = true,
  padding = 14,
  className,
  style,
  children,
}: CardProps) {
  const styles: CSSProperties = {
    background: BG[surface],
    borderRadius: 14,
    border: bordered ? '1px solid rgba(212,168,73,0.33)' : 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    padding,
    color: 'var(--text-parchment)',
    ...style,
  }
  return (
    <div className={className} style={styles}>
      {children}
    </div>
  )
}
