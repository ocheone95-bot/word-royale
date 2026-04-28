// Пиксельный логотип «WORD ROYALE» — chunky 7×10 буквы, нарисованные
// руками. Лого рендерится не как шрифт, а как pixel-art: каждый «лит»
// пиксель — item в box-shadow. На проде стоит экспортировать в PNG
// (1×/2×/3×) чтобы не строить shadow-stack на runtime в Telegram WebView,
// но для итераций дизайна и MVP — пойдёт.
//
// Источник: source/pixel-logo.jsx из Claude Design handoff.

import type { CSSProperties } from 'react'

type LogoChar = 'W' | 'O' | 'R' | 'D' | 'Y' | 'A' | 'L' | 'E' | ' '

const LOGO_FONT: Record<LogoChar, readonly string[]> = {
  W: [
    '11...11',
    '11...11',
    '11...11',
    '11...11',
    '11...11',
    '11...11',
    '11.1.11',
    '11.1.11',
    '1111111',
    '.11.11.',
  ],
  O: [
    '.11111.',
    '1111111',
    '11...11',
    '11...11',
    '11...11',
    '11...11',
    '11...11',
    '11...11',
    '1111111',
    '.11111.',
  ],
  R: [
    '111111.',
    '1111111',
    '11...11',
    '11...11',
    '111111.',
    '1111111',
    '11.11..',
    '11..11.',
    '11...11',
    '11...11',
  ],
  D: [
    '111111.',
    '1111111',
    '11...11',
    '11...11',
    '11...11',
    '11...11',
    '11...11',
    '11...11',
    '1111111',
    '111111.',
  ],
  Y: [
    '11...11',
    '11...11',
    '11...11',
    '.11.11.',
    '.11111.',
    '..111..',
    '..111..',
    '..111..',
    '..111..',
    '..111..',
  ],
  A: [
    '..111..',
    '.11111.',
    '11...11',
    '11...11',
    '11...11',
    '1111111',
    '1111111',
    '11...11',
    '11...11',
    '11...11',
  ],
  L: [
    '11.....',
    '11.....',
    '11.....',
    '11.....',
    '11.....',
    '11.....',
    '11.....',
    '11.....',
    '1111111',
    '1111111',
  ],
  E: [
    '1111111',
    '1111111',
    '11.....',
    '11.....',
    '111111.',
    '111111.',
    '11.....',
    '11.....',
    '1111111',
    '1111111',
  ],
  ' ': [
    '.......',
    '.......',
    '.......',
    '.......',
    '.......',
    '.......',
    '.......',
    '.......',
    '.......',
    '.......',
  ],
}

export type LogoGlowStrength = 'sm' | 'md' | 'lg'

interface PixelLogoProps {
  text: string
  scale?: number
  color?: string
  glow?: string
  glowStrength?: LogoGlowStrength
  style?: CSSProperties
  className?: string
}

function buildGlow(
  scale: number,
  glow: string,
  strength: LogoGlowStrength,
): string {
  const k = scale
  switch (strength) {
    case 'sm':
      return `drop-shadow(0 0 ${k * 0.6}px ${glow}) drop-shadow(0 0 ${k * 1.2}px ${glow}aa)`
    case 'md':
      return `drop-shadow(0 0 ${k * 0.8}px ${glow}) drop-shadow(0 0 ${k * 1.6}px ${glow}cc) drop-shadow(0 0 ${k * 2.4}px ${glow}66)`
    case 'lg':
    default:
      return `drop-shadow(0 0 ${k}px ${glow}) drop-shadow(0 0 ${k * 2}px ${glow}cc) drop-shadow(0 0 ${k * 3.2}px ${glow}88)`
  }
}

export function PixelLogo({
  text,
  scale = 6,
  color = '#ff8c42',
  glow = '#ff8c42',
  glowStrength = 'lg',
  style,
  className,
}: PixelLogoProps) {
  const chars = text.toUpperCase().split('')
  const glyphH = 10
  const gap = 1
  const rows: string[] = Array.from({ length: glyphH }, () => '')
  chars.forEach((c, i) => {
    const key = (c in LOGO_FONT ? c : ' ') as LogoChar
    const g = LOGO_FONT[key]
    for (let y = 0; y < glyphH; y++) {
      rows[y] += g[y] + (i === chars.length - 1 ? '' : '.'.repeat(gap))
    }
  })

  const w = rows[0].length
  const h = rows.length
  const shadows: string[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x] === '1') {
        shadows.push(`${x * scale}px ${y * scale}px 0 0 ${color}`)
      }
    }
  }

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: w * scale,
        height: h * scale,
        filter: buildGlow(scale, glow, glowStrength),
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
          boxShadow: shadows.join(', '),
        }}
      />
    </div>
  )
}
