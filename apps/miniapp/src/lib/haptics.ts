// Тонкий шим над Telegram WebApp.HapticFeedback API.
// На desktop, в браузере вне Telegram и в старых клиентах без HapticFeedback —
// все вызовы no-op. Любое исключение из нативного моста проглатывается:
// вибрация — это вспомогательный UX, она не должна валить кнопку.

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
type NotificationType = 'success' | 'error' | 'warning'

interface HapticFeedbackApi {
  impactOccurred?: (style: ImpactStyle) => void
  notificationOccurred?: (type: NotificationType) => void
  selectionChanged?: () => void
}

interface TelegramWebAppLite {
  HapticFeedback?: HapticFeedbackApi
}

interface WindowWithTelegram {
  Telegram?: { WebApp?: TelegramWebAppLite }
}

function getHaptics(): HapticFeedbackApi | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as WindowWithTelegram
  return w.Telegram?.WebApp?.HapticFeedback ?? null
}

export function hapticSelection(): void {
  try {
    getHaptics()?.selectionChanged?.()
  } catch {
    // ignore
  }
}

export function hapticImpact(style: ImpactStyle = 'light'): void {
  try {
    getHaptics()?.impactOccurred?.(style)
  } catch {
    // ignore
  }
}

export function hapticNotify(type: NotificationType): void {
  try {
    getHaptics()?.notificationOccurred?.(type)
  } catch {
    // ignore
  }
}
