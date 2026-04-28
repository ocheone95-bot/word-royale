// Тонкая обёртка над @sentry/react. Если VITE_SENTRY_DSN не задан, все
// вызовы — no-op (для локальной разработки и до выдачи DSN из Sentry-аккаунта).

import * as Sentry from '@sentry/react'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
const SENTRY_ENV =
  (import.meta.env.VITE_SENTRY_ENV as string | undefined) ??
  (import.meta.env.MODE === 'production' ? 'production' : 'development')

let enabled = false

export function initSentry(): void {
  if (enabled || !SENTRY_DSN) return
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENV,
    // Минимальная конфигурация под Telegram WebView: трейсинг и replay
    // отключены, чтобы не раздувать payload. Включим точечно, если потребуется.
    tracesSampleRate: 0,
    // sendDefaultPii=false — initData содержит подписанный токен Telegram,
    // не хотим, чтобы он улетал в события автоматически.
    sendDefaultPii: false,
  })
  enabled = true
}

export function setSentryUser(
  telegramId: number,
  props?: { username?: string | null; firstName?: string | null },
): void {
  if (!enabled) return
  Sentry.setUser({
    id: String(telegramId),
    username: props?.username ?? undefined,
    // Свободные поля для удобства поиска в Sentry UI.
    first_name: props?.firstName ?? undefined,
  })
}

export function captureError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!enabled) return
  Sentry.captureException(error, context ? { extra: context } : undefined)
}

export function captureMessage(
  message: string,
  context?: Record<string, unknown>,
): void {
  if (!enabled) return
  Sentry.captureMessage(message, context ? { extra: context } : undefined)
}

export function isSentryEnabled(): boolean {
  return Boolean(SENTRY_DSN)
}
