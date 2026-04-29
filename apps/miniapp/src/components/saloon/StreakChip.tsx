// StreakChip — pill со счётчиком ежедневной серии. Pixelify font для
// числа (brand-defining), Nunito для подписи. На дефолтной теме — brass
// border, leather background, лёгкий glow.

import type { CSSProperties } from 'react'
import { plural, t } from '../../lib/i18n'

interface StreakChipProps {
  days: number
  className?: string
  style?: CSSProperties
}

export function StreakChip({ days, className, style }: StreakChipProps) {
  const wrap: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 10px',
    background: 'rgba(58,40,24,0.7)',
    border: '1px solid rgba(212,168,73,0.45)',
    borderRadius: 999,
    color: 'var(--text-parchment-dim)',
    fontFamily: 'var(--font-ui)',
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1,
    ...style,
  }
  const numStyle: CSSProperties = {
    fontFamily: 'var(--font-pixel)',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--accent-brass-hi)',
    textShadow: '0 0 6px rgba(212,168,73,0.5)',
    fontVariantNumeric: 'tabular-nums',
  }
  const form = plural(days, { one: 'one', few: 'few', other: 'other' })
  const tail = t(
    form === 'one'
      ? 'badge.streak_tail_one'
      : form === 'few'
        ? 'badge.streak_tail_few'
        : 'badge.streak_tail_other',
  )
  return (
    <span className={className} style={wrap}>
      <span style={{ color: 'var(--accent-brass)', fontSize: 12 }}>♠</span>
      <span style={numStyle}>{days}</span>
      <span>{tail}</span>
    </span>
  )
}
