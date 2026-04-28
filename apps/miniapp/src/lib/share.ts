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
}

export function buildShareText(input: ShareTextInput): string {
  const lines: string[] = [`Word Royale · ${input.seed}`]
  lines.push(`🟪🟪🟪🟪🟪🟪🟪 → ${input.score}`)
  lines.push(
    input.wordsCount === 1
      ? '1 word found'
      : `${input.wordsCount} words found`,
  )
  if (input.longest && input.longest.length >= 5) {
    lines.push(`🏆 ${input.longest.toUpperCase()}`)
  }
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
    'Word Royale — daily 90-second word puzzle.',
    'Same letters for everyone in the world. Play with me:',
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
