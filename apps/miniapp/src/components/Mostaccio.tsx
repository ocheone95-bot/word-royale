// Mostaccio — пиксельный кот-король Word Royale.
// 28×28 grid, 13 поз, нарисованных процедурно через draw primitives
// (disk, fillRect, set). Каждая поза — delta поверх базового рисунка.
//
// Источник правды: source/cat-sprites.jsx из Claude Design handoff.
// Адаптировано под TS + React. Палитра экспортирована для дальнейших
// тем (Shop preview, Onboarding visuals).
//
// На проде Claude рекомендует экспортировать каждую позу в PNG (1×/2×/3×)
// чтобы не строить ~150-item box-shadow stack на runtime — но JSX-procedural
// быстрее в имплементации, перформанс на современных телефонах OK.
// Решение по PNG-export откладываем до проблемы с FPS.

import { PixelSprite, type PixelPalette } from './PixelSprite'

export const MOSTACCIO_PALETTE: PixelPalette = {
  o: '#1a1108', // outline
  f: '#c98a4a', // body fill
  F: '#e0a565', // body highlight
  d: '#8a5a2c', // forehead stripe
  g: '#f4e4bc', // belly cream
  i: '#d96b54', // pink nose / inner ear
  e: '#0a0604', // eye black
  w: '#fff9e8', // eye glint
  c: '#d4a849', // crown brass
  C: '#f0c66e', // crown highlight
  k: '#8a6a26', // crown shadow
  j: '#c43d2a', // crown ruby
  s: '#ffb84d', // sparkle
  z: '#c9b48a', // zZz colour
  t: '#d4a849', // trophy
  T: '#f0c66e', // trophy highlight
  r: '#9a3f1c', // blanket primary
  R: '#c4541f', // blanket secondary
  W: '#1a1108', // whisker dark on bg
}

export type MostaccioPose =
  | 'idle'
  | 'sleep'
  | 'tilt'
  | 'jump'
  | 'bigjump'
  | 'trophy'
  | 'hmpf'
  | 'proud'
  | 'blanket'
  | 'point'
  | 'pro'
  | 'walk'
  | 'smile'

const W = 28
const H = 28

type Grid = string[][]

function makeGrid(): Grid {
  const g: Grid = []
  for (let y = 0; y < H; y++) g.push(new Array<string>(W).fill('.'))
  return g
}

function set(g: Grid, x: number, y: number, ch: string): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return
  g[y][x] = ch
}

function disk(g: Grid, cx: number, cy: number, r: number, ch: string): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r * r + 0.4) set(g, x, y, ch)
    }
  }
}

function toRows(g: Grid): string[] {
  return g.map((r) => r.join(''))
}

function drawBase(g: Grid): Grid {
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

  // Whiskers (на dark background читаются — символ W чёрный, как outline)
  set(g, 5, 11, 'W'); set(g, 6, 11, 'W'); set(g, 7, 11, 'W')
  set(g, 5, 13, 'W'); set(g, 6, 13, 'W'); set(g, 7, 13, 'W')
  set(g, 21, 11, 'W'); set(g, 22, 11, 'W'); set(g, 23, 11, 'W')
  set(g, 21, 13, 'W'); set(g, 22, 13, 'W'); set(g, 23, 13, 'W')

  // Crown (5 wide, sits above ears between them)
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

function makeIdle(): string[] {
  return toRows(drawBase(makeGrid()))
}

function makeSleep(): string[] {
  const g = drawBase(makeGrid())
  for (let x = 10; x <= 12; x++) {
    g[10][x] = 'o'
    g[9][x] = '.'
    g[11][x] = '.'
  }
  for (let x = 16; x <= 18; x++) {
    g[10][x] = 'o'
    g[9][x] = '.'
    g[11][x] = '.'
  }
  g[9][10] = 'o'; g[9][12] = 'o'
  g[9][16] = 'o'; g[9][18] = 'o'
  g[0][20] = 'z'; g[0][21] = 'z'; g[0][22] = 'z'
  g[1][22] = 'z'
  g[2][20] = 'z'; g[2][21] = 'z'; g[2][22] = 'z'
  return toRows(g)
}

function makeTilt(): string[] {
  const g = drawBase(makeGrid())
  g[9][10] = '.'; g[9][11] = '.'; g[10][10] = '.'; g[10][11] = '.'
  g[9][16] = '.'; g[9][17] = '.'; g[10][16] = '.'; g[10][17] = '.'
  g[9][11] = 'e'; g[9][12] = 'e'
  g[10][11] = 'e'; g[10][12] = 'w'
  g[9][17] = 'e'; g[9][18] = 'e'
  g[10][17] = 'e'; g[10][18] = 'w'
  return toRows(g)
}

function makeJump(): string[] {
  const g = drawBase(makeGrid())
  for (let x = 10; x <= 18; x++) {
    g[24][x] = '.'; g[25][x] = '.'; g[26][x] = '.'
  }
  g[2][7] = 's'; g[3][6] = 's'; g[3][7] = 's'; g[3][8] = 's'; g[4][7] = 's'
  g[2][20] = 's'; g[3][19] = 's'; g[3][20] = 's'; g[3][21] = 's'; g[4][20] = 's'
  g[26][6] = 's'; g[26][22] = 's'
  g[27][7] = 's'; g[27][21] = 's'
  return toRows(g)
}

function makeBigJump(): string[] {
  const g = drawBase(makeGrid())
  for (let x = 10; x <= 18; x++) {
    g[24][x] = '.'; g[25][x] = '.'; g[26][x] = '.'
  }
  for (let i = 0; i < W; i += 2) g[0][i] = 's'
  g[1][6] = 's'; g[1][8] = 's'; g[1][10] = 's'
  g[1][17] = 's'; g[1][19] = 's'; g[1][21] = 's'
  g[2][7] = 's'; g[2][20] = 's'
  for (let x = 11; x <= 16; x++) {
    if (g[2][x] !== 'C') g[2][x] = 'C'
  }
  return toRows(g)
}

function makeTrophy(): string[] {
  const g = drawBase(makeGrid())
  for (let i = 0; i < 12; i += 2) g[0][i] = 's'
  for (let x = 0; x < 6; x++) g[14][x] = 't'
  for (let x = 1; x < 5; x++) {
    g[15][x] = 'T'; g[16][x] = 't'; g[17][x] = 't'
  }
  g[18][2] = 't'; g[18][3] = 't'
  g[19][2] = 't'; g[19][3] = 't'
  g[20][1] = 't'; g[20][2] = 't'; g[20][3] = 't'; g[20][4] = 't'
  for (let x = 0; x < 6; x++) g[21][x] = 't'
  for (let x = 0; x < 6; x++) g[22][x] = 't'
  return toRows(g)
}

function makeHmpf(): string[] {
  const g = drawBase(makeGrid())
  for (let y = 3; y <= 6; y++) {
    for (let x = 8; x <= 12; x++) {
      if ([8, 9, 10, 11, 12].includes(x) && y < 7) g[y][x] = '.'
    }
  }
  for (let y = 3; y <= 6; y++) {
    for (let x = 15; x <= 19; x++) {
      if (y < 7) g[y][x] = '.'
    }
  }
  g[7][6] = 'o'; g[7][7] = 'o'; g[8][6] = 'o'; g[8][7] = 'f'; g[9][7] = 'o'
  g[7][20] = 'o'; g[7][21] = 'o'; g[8][20] = 'f'; g[8][21] = 'o'; g[9][20] = 'o'
  for (let x = 11; x <= 16; x++) g[3][x] = 'o'
  g[13][12] = '.'; g[13][14] = '.'; g[13][16] = '.'
  g[14][13] = '.'; g[14][15] = '.'
  g[14][12] = 'o'; g[14][13] = 'o'; g[14][14] = 'o'; g[14][15] = 'o'; g[14][16] = 'o'
  g[13][12] = 'o'; g[13][16] = 'o'
  return toRows(g)
}

function makeProud(): string[] {
  const g = drawBase(makeGrid())
  for (let y = 24; y <= 26; y++) {
    for (let x = 16; x <= 18; x++) g[y][x] = '.'
  }
  g[15][22] = 'o'; g[15][23] = 'o'
  g[16][22] = 'F'; g[16][23] = 'F'
  g[17][22] = 'o'; g[17][23] = 'o'
  return toRows(g)
}

function makeBlanket(): string[] {
  const g = drawBase(makeGrid())
  for (let y = 16; y <= 24; y++) {
    for (let x = 7; x <= 21; x++) {
      if (g[y][x] === 'g' || g[y][x] === 'f' || g[y][x] === 'F') {
        g[y][x] = (x + y) % 2 === 0 ? 'r' : 'R'
      }
    }
  }
  return toRows(g)
}

function makePoint(): string[] {
  const g = drawBase(makeGrid())
  for (let y = 24; y <= 26; y++) {
    for (let x = 16; x <= 18; x++) g[y][x] = '.'
  }
  g[18][20] = 'o'; g[18][21] = 'o'; g[18][22] = 'o'; g[18][23] = 'o'
  g[19][20] = 'F'; g[19][21] = 'F'; g[19][22] = 'F'; g[19][23] = 'F'
  g[20][20] = 'o'; g[20][21] = 'o'; g[20][22] = 'o'; g[20][23] = 'o'
  return toRows(g)
}

function makePro(): string[] {
  const g = drawBase(makeGrid())
  for (let y = 0; y <= 3; y++) {
    for (let x = 10; x <= 17; x++) g[y][x] = '.'
  }
  for (let x = 9; x <= 18; x++) g[2][x] = 'c'
  for (let x = 9; x <= 18; x++) g[3][x] = 'o'
  g[1][9] = 'k'; g[1][12] = 'j'; g[1][15] = 'j'; g[1][18] = 'k'
  g[1][10] = 'C'; g[1][11] = 'C'; g[1][13] = 'C'; g[1][14] = 'C'
  g[1][16] = 'C'; g[1][17] = 'C'
  g[0][2] = 's'; g[1][1] = 's'; g[1][2] = 's'; g[1][3] = 's'; g[2][2] = 's'
  return toRows(g)
}

function makeWalk(): string[] {
  const g = drawBase(makeGrid())
  for (let y = 24; y <= 26; y++) {
    for (let x = 9; x <= 19; x++) g[y][x] = '.'
  }
  g[25][8] = 'o'; g[25][9] = 'o'; g[25][10] = 'o'
  g[26][8] = 'F'; g[26][9] = 'F'; g[26][10] = 'F'
  g[27][8] = 'o'; g[27][9] = 'o'; g[27][10] = 'o'
  g[24][17] = 'o'; g[24][18] = 'o'; g[24][19] = 'o'
  g[25][17] = 'F'; g[25][18] = 'F'; g[25][19] = 'F'
  g[26][17] = 'o'; g[26][18] = 'o'; g[26][19] = 'o'
  return toRows(g)
}

function makeSmile(): string[] {
  const g = drawBase(makeGrid())
  g[9][10] = '.'; g[9][11] = '.'; g[10][10] = '.'; g[10][11] = '.'
  g[9][16] = '.'; g[9][17] = '.'; g[10][16] = '.'; g[10][17] = '.'
  g[10][10] = 'o'; g[10][12] = 'o'
  g[9][11] = 'o'
  g[10][16] = 'o'; g[10][18] = 'o'
  g[9][17] = 'o'
  g[12][13] = '.'; g[12][14] = '.'; g[13][12] = '.'; g[13][14] = '.'; g[13][16] = '.'
  g[14][13] = '.'; g[14][15] = '.'
  for (let x = 11; x <= 17; x++) g[13][x] = 'o'
  for (let x = 12; x <= 16; x++) g[14][x] = 'g'
  for (let x = 11; x <= 17; x++) g[15][x] = 'o'
  return toRows(g)
}

// Каждая поза — функция, не значение, чтобы не платить ~150 setов
// при импорте модуля. Считается лениво один раз через memoization-кеш.
const POSE_BUILDERS: Record<MostaccioPose, () => string[]> = {
  idle: makeIdle,
  sleep: makeSleep,
  tilt: makeTilt,
  jump: makeJump,
  bigjump: makeBigJump,
  trophy: makeTrophy,
  hmpf: makeHmpf,
  proud: makeProud,
  blanket: makeBlanket,
  point: makePoint,
  pro: makePro,
  walk: makeWalk,
  smile: makeSmile,
}

const poseCache = new Map<MostaccioPose, string[]>()

export function getMostaccioRows(pose: MostaccioPose): string[] {
  let cached = poseCache.get(pose)
  if (!cached) {
    cached = POSE_BUILDERS[pose]()
    poseCache.set(pose, cached)
  }
  return cached
}

interface MostaccioProps {
  pose?: MostaccioPose
  scale?: number
  className?: string
}

export function Mostaccio({
  pose = 'idle',
  scale = 3,
  className,
}: MostaccioProps) {
  const rows = getMostaccioRows(pose)
  return (
    <PixelSprite
      rows={rows}
      palette={MOSTACCIO_PALETTE}
      scale={scale}
      className={className}
    />
  )
}
