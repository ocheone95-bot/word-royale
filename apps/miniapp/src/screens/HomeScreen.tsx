// Главный экран Mini App. Показывает приветствие с именем юзера из Telegram,
// кнопки Play / Buy replay, Leaderboard и Invite friends.
//
// Логика главной кнопки:
//   - не играл сегодня → «Play» (бесплатная игра)
//   - играл и есть replay-кредит → «Play replay (N left)»
//   - играл и кредитов 0 → primary кнопка «Buy replay (50 ⭐)», deep-link в бот.

import { useEffect } from 'react'
import { useRawInitData } from '@telegram-apps/sdk-react'
import { useTelegramUser } from '../hooks/useTelegramUser'
import { useGameStore } from '../store/useGameStore'
import {
  buildBuyReplayDeepLink,
  buildInviteText,
  buildPlayDeepLink,
  buildTelegramShareLink,
} from '../lib/share'
import { openTelegramLink } from '../lib/telegram'
import { track } from '../lib/analytics'

const REPLAY_PRICE_STARS = 50

export default function HomeScreen() {
  const user = useTelegramUser()
  const initData = useRawInitData()
  const startGame = useGameStore((s) => s.startGame)
  const showLeaderboard = useGameStore((s) => s.showLeaderboard)
  const showShop = useGameStore((s) => s.showShop)
  const todayStatus = useGameStore((s) => s.todayStatus)
  const refreshTodayStatus = useGameStore((s) => s.refreshTodayStatus)
  const greeting = user?.firstName ? `Hello, ${user.firstName}!` : 'Hello!'

  // Подгрузка статуса при первом маунте Home и при возврате во вкладку
  // (после оплаты Stars в боте Mini App снова получает focus).
  useEffect(() => {
    if (!initData) return
    void refreshTodayStatus(initData)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshTodayStatus(initData)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [initData, refreshTodayStatus])

  const handleInvite = () => {
    track('invite_clicked')
    const url = buildPlayDeepLink(user?.id ?? null)
    openTelegramLink(buildTelegramShareLink(buildInviteText(), url))
  }

  const handleBuyReplay = () => {
    track('iap_initiated', {
      product_id: 'replay',
      price_stars: REPLAY_PRICE_STARS,
      source: 'home',
    })
    openTelegramLink(buildBuyReplayDeepLink())
  }

  // По умолчанию (статус ещё не загружен) — показываем Play, чтобы не блокировать
  // первый клик. Если submit-score вернёт no_replay, ResultScreen покажет ошибку.
  const playedToday = todayStatus.loaded ? todayStatus.playedToday : false
  const replayCredits = todayStatus.loaded ? todayStatus.replayCredits : 0
  const proActive = todayStatus.loaded && todayStatus.proActive
  const proExpiresAt = todayStatus.loaded ? todayStatus.proExpiresAt : null
  // Pro обходит «Buy replay» — играть можно сколько угодно.
  const noFreeNoCredits = playedToday && replayCredits === 0 && !proActive
  const playLabel = proActive
    ? playedToday
      ? 'Play another'
      : 'Play'
    : !playedToday
      ? 'Play'
      : replayCredits > 0
        ? `Play replay (${replayCredits} left)`
        : 'Play'

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 flex flex-col items-center justify-center px-6 text-white">
      <div className="max-w-md w-full text-center">
        <p className="text-purple-300 mb-2 text-base">{greeting}</p>
        <h1 className="text-5xl font-bold tracking-tight mb-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Word Royale
        </h1>
        <p className="text-slate-300 mb-12 text-lg">
          Daily 90-second word puzzle. Same letters for everyone.
        </p>
        {noFreeNoCredits ? (
          <button
            type="button"
            onClick={handleBuyReplay}
            className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95 transition py-4 rounded-2xl text-xl font-semibold shadow-lg shadow-amber-900/50 mb-3"
          >
            Buy replay · {REPLAY_PRICE_STARS} ⭐
          </button>
        ) : (
          <button
            type="button"
            onClick={startGame}
            className="w-full bg-purple-600 hover:bg-purple-500 active:scale-95 transition py-4 rounded-2xl text-xl font-semibold shadow-lg shadow-purple-900/50 mb-3"
          >
            {playLabel}
          </button>
        )}
        {proActive && (
          <p className="text-xs text-amber-300 mb-3 font-semibold">
            ⭐ Word Pro
            {proExpiresAt
              ? ` · until ${new Date(proExpiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
              : ''}
          </p>
        )}
        {playedToday && !proActive && (
          <p className="text-xs text-slate-400 mb-3">
            You already played today.{' '}
            {replayCredits > 0
              ? `${replayCredits} replay${replayCredits === 1 ? '' : 's'} ready.`
              : 'Buy a replay to play again.'}
          </p>
        )}
        <button
          type="button"
          onClick={showLeaderboard}
          className="w-full border border-slate-600 text-slate-200 active:scale-95 transition py-3 rounded-2xl text-base mb-3"
        >
          Leaderboard
        </button>
        <button
          type="button"
          onClick={showShop}
          className="w-full border border-slate-600 text-slate-200 active:scale-95 transition py-3 rounded-2xl text-base mb-3"
        >
          🛒 Shop
        </button>
        <button
          type="button"
          onClick={handleInvite}
          className="w-full text-purple-300 active:scale-95 transition py-2 rounded-2xl text-sm"
        >
          📤 Invite friends
        </button>
      </div>
    </main>
  )
}
