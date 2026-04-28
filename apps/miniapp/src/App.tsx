// Корневой компонент. Оборачивает HomeScreen в ErrorBoundary, чтобы
// поймать ошибку SDK при запуске вне Telegram и показать понятный fallback.

import { Component, useEffect, useState, type ReactNode } from 'react'
import HomeScreen from './screens/HomeScreen'
import GameScreen from './screens/GameScreen'
import ResultScreen from './screens/ResultScreen'
import LeaderboardScreen from './screens/LeaderboardScreen'
import ShopScreen from './screens/ShopScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import { useGameStore } from './store/useGameStore'
import { useReferralAttribution } from './hooks/useReferralAttribution'
import { useTelegramUser } from './hooks/useTelegramUser'
import { identifyUser } from './lib/analytics'
import { captureError, setSentryUser } from './lib/sentry'
import {
  loadOnboardingDone,
  markOnboardingDone,
} from './lib/onboarding-storage'

type State = { hasError: boolean }

class TelegramErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // SDK-исключения вне TMA (LaunchParamsRetrieveError) ожидаемы — Sentry
    // их не игнорирует автоматически, но «Open in Telegram» fallback убирает
    // их из критичных. Ловим всё подряд, фильтрацию делаем в Sentry-проекте.
    captureError(error, { componentStack: info.componentStack ?? null })
  }

  render() {
    if (this.state.hasError) return <OpenInTelegramFallback />
    return this.props.children
  }
}

function OpenInTelegramFallback() {
  return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6 text-white">
      <div className="max-w-sm text-center">
        <h1 className="text-3xl font-bold mb-3">Open in Telegram</h1>
        <p className="text-slate-300">
          Word Royale runs inside Telegram. Open <span className="text-purple-300">@word_royale_bot</span> and tap Play.
        </p>
      </div>
    </main>
  )
}

function ActiveScreen() {
  const screen = useGameStore((s) => s.screen)
  const Screen =
    screen === 'game'
      ? GameScreen
      : screen === 'result'
        ? ResultScreen
        : screen === 'leaderboard'
          ? LeaderboardScreen
          : screen === 'shop'
            ? ShopScreen
            : HomeScreen
  // key={screen} принудительно ремаунтит wrapper при смене экрана —
  // CSS-анимация screen-fade проигрывается на mount каждого нового экрана.
  return (
    <div key={screen} className="screen-fade">
      <Screen />
    </div>
  )
}

// Отдельный «невидимый» компонент: реф-атрибуция требует Telegram-launch-params,
// которые могут бросить вне TMA. Держим хук под ErrorBoundary рядом с UI-стволом,
// и он не привязан к смене экранов (иначе перезапускался бы при каждом ремаунте).
function ReferralAttributor() {
  useReferralAttribution()
  return null
}

// PostHog identify + Sentry user — один раз за маунт. Без identify события
// летят анонимно и (при person_profiles='identified_only') профиль не
// создаётся — это сэкономит MAU-квоту.
function AnalyticsIdentifier() {
  const user = useTelegramUser()
  useEffect(() => {
    if (!user?.id) return
    identifyUser(user.id, {
      username: user.username ?? null,
      first_name: user.firstName ?? null,
      language_code: user.languageCode ?? null,
      is_premium: user.isPremium ?? false,
    })
    setSentryUser(user.id, {
      username: user.username ?? null,
      firstName: user.firstName ?? null,
    })
  }, [user?.id, user?.username, user?.firstName, user?.languageCode, user?.isPremium])
  return null
}

// Минимальный splash на время async-чтения CloudStorage. Цвет совпадает
// с --bg-room чтобы переход в Home/Onboarding не флэшил белым.
function BootSplash() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-room)',
      }}
    />
  )
}

export default function App() {
  // null — ещё не знаем (читаем CloudStorage); true — показываем
  // онбординг; false — пропускаем. Splash виден только до резолва Promise
  // (обычно <300ms; offline-CloudStorage отдаёт callback почти сразу).
  const [onboardingPending, setOnboardingPending] = useState<boolean | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false
    void loadOnboardingDone().then((done) => {
      if (!cancelled) setOnboardingPending(!done)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const finishOnboarding = () => {
    markOnboardingDone()
    setOnboardingPending(false)
  }

  return (
    <TelegramErrorBoundary>
      <ReferralAttributor />
      <AnalyticsIdentifier />
      {onboardingPending === null ? (
        <BootSplash />
      ) : onboardingPending ? (
        <OnboardingScreen onComplete={finishOnboarding} />
      ) : (
        <ActiveScreen />
      )}
    </TelegramErrorBoundary>
  )
}
