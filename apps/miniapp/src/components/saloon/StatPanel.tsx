// ScorePanel / TimerPanel — близнецы. Eyebrow + value, brass border 40%,
// rgba(0,0,0,.4) bg, glow на value. У TimerPanel есть warning-state
// (timer ≤10s) — красная рамка + pulse animation.
//
// Источник: README "Game" header section + source/phase5.jsx.

import type { CSSProperties } from 'react'

interface StatPanelProps {
  label: string
  value: string
  warning?: boolean
  className?: string
  style?: CSSProperties
}

export function StatPanel({
  label,
  value,
  warning = false,
  className,
  style,
}: StatPanelProps) {
  const wrap: CSSProperties = {
    minWidth: 78,
    background: 'rgba(0,0,0,0.4)',
    border: warning ? '2px solid #ff5a3d' : '1px solid rgba(212,168,73,0.4)',
    borderRadius: 10,
    padding: '6px 14px',
    boxShadow: warning
      ? '0 0 12px rgba(255,90,61,0.6)'
      : 'inset 0 1px 0 rgba(255,255,255,0.05)',
    animation: warning ? 'saloonPulseWarn 0.8s ease-in-out infinite' : undefined,
    color: warning ? '#ff5a3d' : 'var(--accent-brass)',
    ...style,
  }
  const eyebrow: CSSProperties = {
    fontFamily: 'var(--font-pixel)',
    fontSize: 8,
    fontWeight: 600,
    letterSpacing: 1.8,
    color: warning ? '#ff5a3d' : 'var(--accent-brass)',
    textTransform: 'uppercase',
    lineHeight: 1,
    marginBottom: 4,
  }
  const valueStyle: CSSProperties = {
    fontFamily: 'var(--font-pixel)',
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1,
    color: 'inherit',
    textShadow: warning
      ? '0 0 6px #ff5a3d, 0 0 14px rgba(255,90,61,0.5)'
      : '0 0 6px var(--accent-brass-hi), 0 0 14px rgba(212,168,73,0.5)',
    fontVariantNumeric: 'tabular-nums',
  }
  return (
    <div className={className} style={wrap}>
      <div style={eyebrow}>{label}</div>
      <div style={valueStyle}>{value}</div>
    </div>
  )
}
