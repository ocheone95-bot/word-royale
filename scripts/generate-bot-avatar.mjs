// Генерирует bot-avatar.png — квадратный 512×512 аватар для @BotFather
// в saloon-стиле. Mostaccio в позе 'proud' (с короной), warm amber radial
// background, brass border ring (как poker chip).
//
// Использование: `node scripts/generate-bot-avatar.mjs`
// Output: apps/miniapp/public/bot-avatar.png и .svg
//
// Pose-defs скопированы из apps/miniapp/src/components/Mostaccio.tsx —
// этот скрипт намеренно не зависит от React/TS, чтобы можно было запускать
// чистым Node без bundler'а. Если в будущем меняем Mostaccio — синкаем здесь.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = resolve(__dirname, '..', 'apps/miniapp/public')

// Палитра Mostaccio — должна совпадать с MOSTACCIO_PALETTE в Mostaccio.tsx.
const PALETTE = {
  o: '#1a1108',
  f: '#c98a4a',
  F: '#e0a565',
  d: '#8a5a2c',
  g: '#f4e4bc',
  i: '#d96b54',
  e: '#0a0604',
  w: '#fff9e8',
  c: '#d4a849',
  C: '#f0c66e',
  k: '#8a6a26',
  j: '#c43d2a',
  s: '#ffb84d',
  z: '#c9b48a',
  t: '#d4a849',
  T: '#f0c66e',
  r: '#9a3f1c',
  R: '#c4541f',
  W: '#1a1108',
}

// === Mostaccio draw helpers (copy of Mostaccio.tsx logic) ===

const W = 28
const H = 28

function makeGrid() {
  const g = []
  for (let y = 0; y < H; y++) g.push(new Array(W).fill('.'))
  return g
}

function set(g, x, y, ch) {
  if (x < 0 || y < 0 || x >= W || y >= H) return
  g[y][x] = ch
}

function disk(g, cx, cy, r, ch) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r * r + 0.4) set(g, x, y, ch)
    }
  }
}

function drawBase(g) {
  // Body
  disk(g, 14, 19.5, 7, 'f')
  disk(g, 14, 19.5, 7.5, 'o')
  disk(g, 14, 19.5, 6.6, 'f')
  disk(g, 14, 21, 4.5, 'g')

  // Head
  disk(g, 14, 10, 5.6, 'o')
  disk(g, 14, 10, 4.8, 'f')

  // Forehead stripe
  set(g, 11, 7, 'd'); set(g, 12, 7, 'd')
  set(g, 14, 7, 'd'); set(g, 15, 7, 'd')
  set(g, 17, 7, 'd')
  set(g, 12, 8, 'd'); set(g, 14, 8, 'd'); set(g, 16, 8, 'd')

  // Left ear
  set(g, 10, 3, 'o')
  set(g, 9, 4, 'o'); set(g, 10, 4, 'f'); set(g, 11, 4, 'o')
  set(g, 9, 5, 'o'); set(g, 10, 5, 'f'); set(g, 11, 5, 'i'); set(g, 12, 5, 'o')
  set(g, 9, 6, 'o'); set(g, 10, 6, 'f'); set(g, 11, 6, 'f'); set(g, 12, 6, 'f')

  // Right ear
  set(g, 17, 3, 'o')
  set(g, 16, 4, 'o'); set(g, 17, 4, 'f'); set(g, 18, 4, 'o')
  set(g, 15, 5, 'o'); set(g, 16, 5, 'i'); set(g, 17, 5, 'f'); set(g, 18, 5, 'o')
  set(g, 15, 6, 'f'); set(g, 16, 6, 'f'); set(g, 17, 6, 'f'); set(g, 18, 6, 'o')

  // Eyes
  set(g, 10, 9, 'e'); set(g, 11, 9, 'e')
  set(g, 10, 10, 'e'); set(g, 11, 10, 'w')
  set(g, 16, 9, 'e'); set(g, 17, 9, 'e')
  set(g, 16, 10, 'e'); set(g, 17, 10, 'w')

  // Nose
  set(g, 13, 11, 'i'); set(g, 14, 11, 'i')
  set(g, 13, 12, 'i'); set(g, 14, 12, 'i')

  // Mouth
  set(g, 12, 13, 'o'); set(g, 14, 13, 'o'); set(g, 16, 13, 'o')
  set(g, 13, 14, 'o'); set(g, 15, 14, 'o')

  // Cheek puffs
  set(g, 9, 12, 'F'); set(g, 9, 13, 'F')
  set(g, 19, 12, 'F'); set(g, 19, 13, 'F')

  // Whiskers
  set(g, 5, 11, 'W'); set(g, 6, 11, 'W'); set(g, 7, 11, 'W')
  set(g, 5, 13, 'W'); set(g, 6, 13, 'W'); set(g, 7, 13, 'W')
  set(g, 21, 11, 'W'); set(g, 22, 11, 'W'); set(g, 23, 11, 'W')
  set(g, 21, 13, 'W'); set(g, 22, 13, 'W'); set(g, 23, 13, 'W')

  // Crown
  set(g, 11, 2, 'k'); set(g, 12, 2, 'C'); set(g, 13, 2, 'c')
  set(g, 14, 2, 'C'); set(g, 15, 2, 'c'); set(g, 16, 2, 'k')
  set(g, 11, 1, 'k'); set(g, 13, 1, 'j'); set(g, 16, 1, 'k')
  set(g, 12, 1, 'C'); set(g, 14, 1, 'C'); set(g, 15, 1, 'C')
  for (let x = 11; x <= 16; x++) set(g, x, 3, 'o')

  // Front paws
  set(g, 10, 24, 'o'); set(g, 11, 24, 'o'); set(g, 12, 24, 'o')
  set(g, 10, 25, 'F'); set(g, 11, 25, 'F'); set(g, 12, 25, 'F')
  set(g, 16, 24, 'o'); set(g, 17, 24, 'o'); set(g, 18, 24, 'o')
  set(g, 16, 25, 'F'); set(g, 17, 25, 'F'); set(g, 18, 25, 'F')
  set(g, 10, 26, 'o'); set(g, 11, 26, 'o'); set(g, 12, 26, 'o')
  set(g, 16, 26, 'o'); set(g, 17, 26, 'o'); set(g, 18, 26, 'o')

  // Tail
  set(g, 22, 22, 'o'); set(g, 23, 21, 'o'); set(g, 24, 20, 'o'); set(g, 24, 19, 'o')
  set(g, 22, 23, 'f'); set(g, 23, 22, 'f'); set(g, 24, 21, 'f'); set(g, 25, 20, 'o')
  set(g, 25, 19, 'f'); set(g, 24, 18, 'o'); set(g, 25, 18, 'o')

  return g
}

function makeProud() {
  const g = drawBase(makeGrid())
  // 'proud' overlay — front paw raised, trophy-style victory pose
  for (let y = 24; y <= 26; y++) {
    for (let x = 16; x <= 18; x++) g[y][x] = '.'
  }
  g[15][22] = 'o'; g[15][23] = 'o'
  g[16][22] = 'F'; g[16][23] = 'F'
  g[17][22] = 'o'; g[17][23] = 'o'
  return g
}

// === SVG composition ===

const CANVAS = 512
const SPRITE_SCALE = 12 // 28 × 12 = 336px (центр canvas, ~336/512 = 65%)
const SPRITE_SIZE = W * SPRITE_SCALE // 336
const SPRITE_OFFSET = (CANVAS - SPRITE_SIZE) / 2 // 88

function buildSvg() {
  const grid = makeProud()
  const rects = []

  // Saloon background — radial warm amber → deep brown.
  // Brass border ring — outer 16px stroke в brass tint.
  const RING_COLOR = '#d4a849'
  const BG_OUTER = '#0a0604'
  const BG_INNER = '#3a2818'
  const PIXEL_OUTER = '#ff8c42' // saloon lamp tint glow

  let svg = ''
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">`

  // Defs: radial gradient + soft glow filter
  svg += `<defs>`
  svg += `<radialGradient id="bg" cx="50%" cy="38%" r="62%">`
  svg += `<stop offset="0%" stop-color="${BG_INNER}"/>`
  svg += `<stop offset="100%" stop-color="${BG_OUTER}"/>`
  svg += `</radialGradient>`
  svg += `<radialGradient id="rim" cx="50%" cy="50%" r="50%">`
  svg += `<stop offset="92%" stop-color="rgba(255,140,66,0)"/>`
  svg += `<stop offset="98%" stop-color="${PIXEL_OUTER}"/>`
  svg += `<stop offset="100%" stop-color="rgba(255,140,66,0)"/>`
  svg += `</radialGradient>`
  svg += `<filter id="glow" x="-20%" y="-20%" width="140%" height="140%">`
  svg += `<feGaussianBlur stdDeviation="3"/>`
  svg += `</filter>`
  svg += `</defs>`

  // Square base (Telegram avatars круглят сами на UI, поэтому угол не критичен,
  // но мы рисуем background full square).
  svg += `<rect width="${CANVAS}" height="${CANVAS}" fill="url(#bg)"/>`

  // Brass ring — для Telegram-аватарки рисуем circle stroke близко к краю.
  // Telegram круглит canvas → ring сидит точно по контуру.
  const RING_R = 248 // чуть меньше половины 512 чтобы влезло в круглый crop
  const RING_W = 8
  svg += `<circle cx="${CANVAS / 2}" cy="${CANVAS / 2}" r="${RING_R}" `
  svg += `fill="none" stroke="${RING_COLOR}" stroke-width="${RING_W}" opacity="0.55"/>`

  // Inner subtle rim glow
  svg += `<circle cx="${CANVAS / 2}" cy="${CANVAS / 2}" r="${RING_R - 6}" `
  svg += `fill="url(#rim)" opacity="0.4"/>`

  // Mostaccio sprite — каждый «лит» пиксель = rect.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = grid[y][x]
      if (ch === '.' || ch === ' ') continue
      const color = PALETTE[ch]
      if (!color) continue
      const px = SPRITE_OFFSET + x * SPRITE_SCALE
      const py = SPRITE_OFFSET + y * SPRITE_SCALE
      svg += `<rect x="${px}" y="${py}" width="${SPRITE_SCALE}" height="${SPRITE_SCALE}" fill="${color}"/>`
    }
  }

  svg += `</svg>`
  return svg
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const svg = buildSvg()
  const svgPath = resolve(OUTPUT_DIR, 'bot-avatar.svg')
  const pngPath = resolve(OUTPUT_DIR, 'bot-avatar.png')
  writeFileSync(svgPath, svg)
  console.log(`✓ wrote ${svgPath}`)

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: CANVAS },
    background: 'transparent',
  })
  const png = resvg.render().asPng()
  writeFileSync(pngPath, png)
  console.log(`✓ wrote ${pngPath} (${png.length} bytes)`)
}

main()
