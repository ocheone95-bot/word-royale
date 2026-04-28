// ProBadge — маленькая иконка-плашка возле имени Pro-юзера.
// Brass-тинт, pixel crown SVG, "PRO" text. Должна выглядеть «заслуженной»,
// не куплено за деньги — поэтому stripe-glow без блёсток.

import type { CSSProperties } from 'react'

interface ProBadgeProps {
  className?: string
  style?: CSSProperties
}

export function ProBadge({ className, style }: ProBadgeProps) {
  const wrap: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    background: 'rgba(212,168,73,0.18)',
    border: '1px solid rgba(212,168,73,0.55)',
    borderRadius: 6,
    boxShadow: '0 0 8px rgba(212,168,73,0.35)',
    color: 'var(--accent-brass-hi)',
    fontFamily: 'var(--font-pixel)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    lineHeight: 1,
    ...style,
  }
  return (
    <span className={className} style={wrap}>
      <CrownIcon />
      PRO
    </span>
  )
}

function CrownIcon() {
  return (
    <svg
      width="11"
      height="9"
      viewBox="0 0 11 9"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M1 2 L2.5 5 L4 1.5 L5.5 5 L7 1.5 L8.5 5 L10 2 L9 8 L2 8 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
