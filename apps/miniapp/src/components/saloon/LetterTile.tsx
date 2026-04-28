// Hero-компонент дизайна. Круглая «poker chip» плитка с буквой,
// brass border + radial gradient + multi-layer shadow для эффекта
// поднятого фишка, при selected — translateY с overshoot easing
// и amber glow стэк. Размер: 50px (Game rack), 32px (Home preview).
//
// Источник правды по размерам/теням/анимации: README раздел "Letter tile"
// + source/phase5.jsx (Tile5 component) из Claude Design handoff.

import type { CSSProperties } from 'react'

interface LetterTileProps {
  letter: string
  size?: number
  selected?: boolean
  order?: number | null
  onClick?: () => void
  disabled?: boolean
  className?: string
}

const IDLE_SHADOW = [
  '0 5px 0 rgba(0,0,0,.5)',
  'inset 0 -4px 10px rgba(0,0,0,.65)',
  'inset 0 3px 5px rgba(255,255,255,.2)',
].join(', ')

const SELECTED_SHADOW = [
  '0 0 0 3px #ff8c42',
  '0 0 24px #ff8c42',
  '0 0 44px #ff8c42',
  'inset 0 -4px 10px rgba(0,0,0,.6)',
  'inset 0 2px 5px rgba(255,255,255,.25)',
].join(', ')

export function LetterTile({
  letter,
  size = 50,
  selected = false,
  order = null,
  onClick,
  disabled = false,
  className,
}: LetterTileProps) {
  const fontSize = Math.round(size * 0.55)

  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    border: '3px solid var(--accent-brass)',
    background:
      'radial-gradient(circle at 38% 32%, #3a2818 0%, #0a0604 95%)',
    boxShadow: selected ? SELECTED_SHADOW : IDLE_SHADOW,
    transform: selected ? 'translateY(-7px) scale(1.05)' : 'none',
    transition: 'transform 160ms cubic-bezier(.34,1.56,.64,1), box-shadow 160ms ease-out',
    color: 'var(--text-parchment)',
    fontFamily: 'var(--font-pixel)',
    fontWeight: 700,
    fontSize,
    lineHeight: 1,
    textTransform: 'uppercase',
    textShadow: selected
      ? '0 0 6px var(--glow-pixel), 0 0 14px var(--accent-lamp)'
      : '0 0 4px rgba(255,184,77,.4)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    padding: 0,
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={style}
    >
      {letter}
      {selected && order !== null && order >= 0 && (
        <OrderBadge order={order} />
      )}
    </button>
  )
}

function OrderBadge({ order }: { order: number }) {
  return (
    <span
      style={{
        position: 'absolute',
        top: -2,
        right: -2,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: 'var(--bg-room)',
        border: '1.5px solid var(--accent-lamp)',
        boxShadow: '0 0 6px var(--accent-lamp)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-pixel)',
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--accent-lamp)',
        lineHeight: 1,
      }}
    >
      {order + 1}
    </span>
  )
}
