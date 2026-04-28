// Saloon-Button — четыре варианта (primary/secondary/ghost/destructive)
// и три размера (sm/md/lg). Primary — amber lamp glow с inset «лит»
// эффектом. Secondary — parchment outline. Все варианты одинаково
// поддерживают disabled. Шрифт: Nunito 800 uppercase tracked.

import type { CSSProperties, ReactNode, ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive'
type Size = 'sm' | 'md' | 'lg'

interface SaloonButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  children: ReactNode
}

const SIZE_MAP: Record<Size, { height: number; px: number; fontSize: number }> = {
  sm: { height: 36, px: 16, fontSize: 12 },
  md: { height: 46, px: 22, fontSize: 14 },
  lg: { height: 50, px: 24, fontSize: 17 },
}

function variantStyle(variant: Variant): CSSProperties {
  switch (variant) {
    case 'primary':
      return {
        background: 'var(--accent-lamp)',
        color: 'var(--text-charcoal)',
        border: 'none',
        boxShadow:
          '0 0 22px rgba(255,140,66,0.6), inset 0 -3px 0 rgba(0,0,0,0.25)',
      }
    case 'secondary':
      return {
        background: 'transparent',
        color: 'var(--text-parchment)',
        border: '1.5px solid var(--text-parchment)',
        boxShadow: 'none',
      }
    case 'ghost':
      return {
        background: 'transparent',
        color: 'var(--text-parchment-dim)',
        border: 'none',
        boxShadow: 'none',
      }
    case 'destructive':
      return {
        background: 'var(--ember-warn)',
        color: 'var(--text-parchment)',
        border: 'none',
        boxShadow: '0 0 16px rgba(154,63,28,0.6), inset 0 -3px 0 rgba(0,0,0,0.3)',
      }
  }
}

export function SaloonButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  style: styleProp,
  ...rest
}: SaloonButtonProps) {
  const sizeSpec = SIZE_MAP[size]
  const style: CSSProperties = {
    ...variantStyle(variant),
    height: sizeSpec.height,
    paddingInline: sizeSpec.px,
    fontFamily: 'var(--font-ui)',
    fontWeight: 800,
    fontSize: sizeSpec.fontSize,
    letterSpacing: 1,
    textTransform: 'uppercase',
    borderRadius: 10,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : loading ? 0.7 : 1,
    transition: 'transform 120ms ease-out, opacity 120ms ease-out',
    width: fullWidth ? '100%' : undefined,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    ...styleProp,
  }

  return (
    <button type="button" disabled={disabled || loading} style={style} {...rest}>
      {loading ? '…' : children}
    </button>
  )
}
