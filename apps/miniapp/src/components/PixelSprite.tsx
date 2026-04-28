// Renderer для 8-bit спрайтов через box-shadow stack: один <div> seed,
// каждый «лит» пиксель — это item в box-shadow. Даёт идеальную чёткость
// при любом scale без raster-зависимостей. Источник правды для маскота
// и пиксельного логотипа.
//
// Источник: source/pixel-art.jsx из Claude Design handoff. Адаптировано
// под TS + React (без window-globals, без Babel-in-browser).

import type { CSSProperties } from 'react'

export type PixelPalette = Record<string, string>

export interface GlowSpec {
  blur: number
  color: string
}

interface PixelSpriteProps {
  rows: readonly string[]
  palette: PixelPalette
  scale?: number
  glow?: GlowSpec | null
  style?: CSSProperties
  className?: string
}

export function PixelSprite({
  rows,
  palette,
  scale = 4,
  glow = null,
  style,
  className,
}: PixelSpriteProps) {
  const h = rows.length
  const w = Math.max(...rows.map((r) => r.length))
  const shadows: string[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x]
      if (ch === '.' || ch === ' ') continue
      const color = palette[ch]
      if (!color) continue
      shadows.push(`${x * scale}px ${y * scale}px 0 0 ${color}`)
    }
  }
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: w * scale,
        height: h * scale,
        // Чисто декоративный спрайт — не должен ловить тапы поверх
        // интерактивных карточек, особенно при shrink на маленьких экранах.
        pointerEvents: 'none',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: scale,
          height: scale,
          backgroundColor: 'transparent',
          boxShadow: shadows.join(', '),
          filter: glow
            ? `drop-shadow(0 0 ${glow.blur}px ${glow.color})`
            : undefined,
        }}
      />
    </div>
  )
}
