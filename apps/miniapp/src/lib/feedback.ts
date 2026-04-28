// Конфиг кнопки Send feedback в MeScreen.
// Открывает чат с PM в Telegram с pre-filled текстом.
// Если PM решит сменить адресата (или собрать feedback в отдельный канал/группу) —
// меняем единственную константу FEEDBACK_USERNAME ниже.

const FEEDBACK_USERNAME = 'ocheone95'

const FEEDBACK_PREFILL =
  'Word Royale feedback: '

export function buildFeedbackDeepLink(): string {
  const params = new URLSearchParams({ text: FEEDBACK_PREFILL })
  return `https://t.me/${FEEDBACK_USERNAME}?${params.toString()}`
}
