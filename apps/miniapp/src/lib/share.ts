// Утилиты для Share-кнопки на ResultScreen и Invite-кнопки на HomeScreen.
// Текст в Wordle-стиле + deep-link `https://t.me/word_royale_bot/play?startapp=ref_<id>`,
// который сразу открывает Mini App с реф-атрибуцией. Бот-handler для команды
// /start не нужен: startapp= обрабатывает Telegram-клиент и Mini App видит
// referral в start_param.

const BOT_USERNAME = 'word_royale_bot'

export interface ShareTextInput {
  seed: string
  score: number
  wordsCount: number
  longest?: string | null
  dayNumber?: number | null
}

// Иконка-аксель в зависимости от уровня результата.
// Saloon-vibe: 🃏 — обычный заход, 🏆 — крепкий ран, 👑 — чемпион.
function trophyForScore(score: number): string {
  if (score >= 3000) return '👑'
  if (score >= 1500) return '🏆'
  return '🃏'
}

function formatScore(n: number): string {
  return n.toLocaleString('en-US')
}

export function buildShareText(input: ShareTextInput): string {
  const trophy = trophyForScore(input.score)
  const day =
    typeof input.dayNumber === 'number' && input.dayNumber > 0
      ? `Day ${input.dayNumber}`
      : input.seed
  const lines: string[] = []
  lines.push(`${trophy} Word Royale · ${day}`)
  // Wordle-стиль блок: 7 квадратов в saloon-палитре (orange lamp).
  lines.push(`🟧🟧🟧🟧🟧🟧🟧 → ${formatScore(input.score)}`)
  const wordsLine =
    input.wordsCount === 1 ? '1 word found' : `${input.wordsCount} words found`
  if (input.longest && input.longest.length >= 5) {
    lines.push(`${wordsLine} · longest: ${input.longest.toUpperCase()}`)
  } else {
    lines.push(wordsLine)
  }
  lines.push('')
  lines.push('Play today’s puzzle ↓')
  return lines.join('\n')
}

// referrerTelegramId === null → ссылка без реф-атрибуции (для тех, кто не залогинен).
export function buildPlayDeepLink(referrerTelegramId: number | null): string {
  const base = `https://t.me/${BOT_USERNAME}/play`
  if (referrerTelegramId == null) return base
  return `${base}?startapp=ref_${referrerTelegramId}`
}

// Deep-link на бот, который при /start payload=buy_<product> сразу шлёт
// Stars-инвойс на этот продукт (бот-handler в apps/bot/src/handlers/start.ts).
export function buildBuyDeepLink(productId: string): string {
  return `https://t.me/${BOT_USERNAME}?start=buy_${productId}`
}

export function buildBuyReplayDeepLink(): string {
  return buildBuyDeepLink('replay')
}

export function buildBuyThemeDeepLink(themeId: string): string {
  return buildBuyDeepLink(`theme_${themeId}`)
}

export function buildTelegramShareLink(text: string, url: string): string {
  const params = new URLSearchParams({ url, text })
  return `https://t.me/share/url?${params.toString()}`
}

// Текст для кнопки Invite на HomeScreen (нет ещё результата, нечего хвастаться).
export function buildInviteText(): string {
  return [
    '🃏 Word Royale',
    'Daily 90-second word puzzle.',
    'Same 7 letters for everyone in the world — pick your moment, play with me ↓',
  ].join('\n')
}

// `start_param` в Telegram WebApp ограничен по символам — допустим
// `[A-Za-z0-9_-]{1,64}`. Парсер ниже принимает только наш формат `ref_<digits>`.
const REFERRAL_PREFIX = 'ref_'

export function parseReferralStartParam(raw: string | null | undefined): number | null {
  if (!raw || !raw.startsWith(REFERRAL_PREFIX)) return null
  const rest = raw.slice(REFERRAL_PREFIX.length)
  if (!/^\d{1,20}$/.test(rest)) return null
  const id = Number(rest)
  if (!Number.isSafeInteger(id) || id <= 0) return null
  return id
}
