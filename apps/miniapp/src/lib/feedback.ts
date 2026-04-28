// Конфиг кнопки Send feedback в MeScreen.
// Открывает чат с PM в Telegram с pre-filled текстом.
// Если PM решит сменить адресата (или собрать feedback в отдельный канал/группу) —
// меняем единственную константу FEEDBACK_USERNAME ниже.

const FEEDBACK_USERNAME = 'mnkdmt'

const FEEDBACK_PREFILL =
  'Word Royale feedback: '

export function buildFeedbackDeepLink(): string {
  // encodeURIComponent (пробел → %20) вместо URLSearchParams (пробел → +) —
  // иначе Telegram кое-где показывает плюсики дословно.
  return `https://t.me/${FEEDBACK_USERNAME}?text=${encodeURIComponent(FEEDBACK_PREFILL)}`
}
