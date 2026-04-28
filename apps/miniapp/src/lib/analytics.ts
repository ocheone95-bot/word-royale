// Тонкая обёртка над posthog-js. Если VITE_POSTHOG_KEY не задан, все
// вызовы — no-op (это же поведение в локальной разработке без env).
// Идентификация юзера через identifyUser(telegramId) — без неё события
// шлются как анонимные, но мы используем person_profiles='identified_only',
// поэтому до identify профиль в PostHog не создаётся.

import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const POSTHOG_HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ??
  'https://us.i.posthog.com'

let enabled = false

export function initAnalytics(): void {
  if (enabled || !POSTHOG_KEY) return
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
  })
  enabled = true
}

export function identifyUser(
  telegramId: number,
  props?: Record<string, unknown>,
): void {
  if (!enabled) return
  posthog.identify(String(telegramId), props)
}

export function track(
  event: string,
  props?: Record<string, unknown>,
): void {
  if (!enabled) return
  posthog.capture(event, props)
}

export function isAnalyticsEnabled(): boolean {
  return Boolean(POSTHOG_KEY)
}
