// Экран итогов партии. Показывает финальный счёт, найденные слова, статус
// серверной отправки и кнопки Play again / Home. После маунта сразу шлёт
// сессию в submit-score; если что-то пошло не так — показывает причину
// и кнопку Retry. Rate-limit «1 игра в день» подключим на Неделе 4.

import { useEffect, useState } from 'react'
import { useRawInitData } from '@telegram-apps/sdk-react'
import { useGameStore } from '../store/useGameStore'
import { useTelegramUser } from '../hooks/useTelegramUser'
import {
  buildBuyReplayDeepLink,
  buildPlayDeepLink,
  buildShareText,
  buildTelegramShareLink,
} from '../lib/share'
import { openTelegramLink } from '../lib/telegram'
import { isMonetagAvailable } from '../lib/monetag'
import { track } from '../lib/analytics'
import { hapticImpact } from '../lib/haptics'
import { useTickUp } from '../hooks/useTickUp'

const REPLAY_PRICE_STARS = 50

const ERROR_MESSAGES: Record<string, string> = {
  env_missing: 'App is not configured.',
  network: 'Network problem. Tap retry.',
  invalid_init_data: 'Telegram session invalid. Reopen the bot.',
  server_misconfigured: 'Server not ready. Try again in a minute.',
  seed_mismatch: 'A new day has started — play again.',
  letters_mismatch: 'Letters mismatch. Play again.',
  score_mismatch: 'Score mismatch.',
  duplicate_word: 'Duplicate word in submission.',
  word_not_composable: 'Word does not match the letters.',
  word_length: 'Word length out of range.',
  words_not_in_dictionary: 'A word is not in the dictionary.',
  bad_response: 'Server returned an unexpected response.',
  no_replay: 'Already played today. Buy a replay to save another result.',
}

function describeError(code: string | null): string {
  if (!code) return 'Could not save result.'
  return ERROR_MESSAGES[code] ?? `Could not save result (${code}).`
}

export default function ResultScreen() {
  const score = useGameStore((s) => s.score)
  const serverScore = useGameStore((s) => s.serverScore)
  const doubleScoreApplied = useGameStore((s) => s.doubleScoreApplied)
  const foundWords = useGameStore((s) => s.foundWords)
  const seed = useGameStore((s) => s.seed)
  const startGame = useGameStore((s) => s.startGame)
  const goHome = useGameStore((s) => s.goHome)
  const showLeaderboard = useGameStore((s) => s.showLeaderboard)
  const handleStartReplay = () => {
    hapticImpact('medium')
    startGame()
  }
  const handleGoHome = () => {
    hapticImpact('light')
    goHome()
  }
  const handleShowLeaderboard = () => {
    hapticImpact('light')
    showLeaderboard()
  }
  const submitStatus = useGameStore((s) => s.submitStatus)
  const submitError = useGameStore((s) => s.submitError)
  const submitCurrentSession = useGameStore((s) => s.submitCurrentSession)
  const todayStatus = useGameStore((s) => s.todayStatus)
  const watchRewardedAd = useGameStore((s) => s.watchRewardedAd)
  const [adInProgress, setAdInProgress] = useState(false)
  const [adError, setAdError] = useState<string | null>(null)

  const initData = useRawInitData()
  const tgUser = useTelegramUser()

  useEffect(() => {
    if (initData && submitStatus === 'idle') {
      void submitCurrentSession(initData)
    }
  }, [initData, submitStatus, submitCurrentSession])

  // serverScore = клиентский score × 2, если был активен Double Score boost.
  // До серверного ответа показываем клиентский счёт. Tick-up анимирует от 0
  // до текущего значения; пересчитывается, если серверный ×2 апгрейдит счёт.
  const displayScore = serverScore ?? score
  const animatedScore = useTickUp(displayScore, 800)
  const longest = foundWords.reduce((a, b) => (b.length > a.length ? b : a), '')
  const sorted = [...foundWords].sort((a, b) => b.length - a.length || a.localeCompare(b))

  // После сохранения сессии: если кредитов больше нет, «Play again» меняется
  // на «Buy replay» (deep-link в бот). До сохранения и без статуса — оставляем
  // обычный Play again, пользовательский тап вызовет startGame и потом, при
  // submit'е, либо спишется кредит, либо вернётся ошибка no_replay.
  const knowStatus = todayStatus.loaded
  const replayCredits = knowStatus ? todayStatus.replayCredits : null
  const proActive = knowStatus && todayStatus.proActive
  const adsWatchedToday = knowStatus ? todayStatus.adsWatchedToday : 0
  const adsMaxPerDay = knowStatus ? todayStatus.adsMaxPerDay : 0
  // Pro обходит «Buy replay» — играть можно сколько угодно.
  const needsBuyReplay = knowStatus && replayCredits === 0 && !proActive
  // Бесплатный replay через рекламу: SDK подключен, дневной лимит не исчерпан,
  // и юзеру реально нужен ещё replay (нет credits, нет Pro).
  const adReplayAvailable =
    needsBuyReplay &&
    isMonetagAvailable() &&
    adsMaxPerDay > 0 &&
    adsWatchedToday < adsMaxPerDay
  const handleBuyReplay = () => {
    hapticImpact('medium')
    track('iap_initiated', {
      product_id: 'replay',
      price_stars: REPLAY_PRICE_STARS,
      source: 'result',
    })
    openTelegramLink(buildBuyReplayDeepLink())
  }
  const handleWatchAd = async () => {
    if (!initData || adInProgress) return
    hapticImpact('light')
    setAdInProgress(true)
    setAdError(null)
    const res = await watchRewardedAd(initData)
    setAdInProgress(false)
    if (!res.ok) {
      setAdError(
        res.reason === 'limit'
          ? 'Daily ad limit reached.'
          : 'Ad not available right now.',
      )
    }
    // На success todayStatus.replayCredits уже обновлён в стор'е — UI ниже
    // переключится на «Play replay» автоматически.
  }

  // Share становится активным после серверного подтверждения ИЛИ в случае
  // no_replay — счёт настоящий (юзер реально играл и набрал очки), просто
  // rate-limit не дал сохранить второй результат за день. Запрещать шарить
  // в этом случае было бы UX-облом без причины.
  const canShare = submitStatus === 'success' || submitError === 'no_replay'
  const handleShare = () => {
    if (!canShare) return
    hapticImpact('light')
    track('share_clicked', {
      score: displayScore,
      words_count: foundWords.length,
      seed,
    })
    const text = buildShareText({
      seed,
      score: displayScore,
      wordsCount: foundWords.length,
      longest: longest || null,
    })
    const url = buildPlayDeepLink(tgUser?.id ?? null)
    openTelegramLink(buildTelegramShareLink(text, url))
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 flex flex-col px-6 py-8 text-white">
      <header className="flex items-center justify-between mb-8">
        <button
          type="button"
          onClick={handleGoHome}
          className="text-purple-300 active:scale-95 transition text-sm"
        >
          ← Home
        </button>
        <span className="text-xs text-slate-400 font-mono">{seed}</span>
        <span className="w-12" />
      </header>

      <div className="flex-1 flex flex-col items-center">
        <p className="text-purple-300 mb-2 text-sm uppercase tracking-widest">Time's up</p>
        <h1 className="text-7xl font-bold tracking-tight mb-1 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent tabular-nums">
          {animatedScore}
        </h1>
        {doubleScoreApplied && (
          <p className="mb-2 text-xs font-bold text-amber-400 uppercase tracking-widest">
            ×2 boost applied
          </p>
        )}
        <p className="text-slate-400 text-sm mb-6">
          {foundWords.length} word{foundWords.length === 1 ? '' : 's'}
          {longest ? ` · longest: ${longest.toUpperCase()}` : ''}
        </p>

        <SubmitStatusBlock
          status={submitStatus}
          error={submitError}
          hasInitData={Boolean(initData)}
          onRetry={() => {
            hapticImpact('light')
            if (initData) void submitCurrentSession(initData)
          }}
          onViewLeaderboard={handleShowLeaderboard}
        />

        {sorted.length > 0 ? (
          <div className="w-full max-w-sm mb-10">
            <div className="flex flex-wrap gap-2 justify-center">
              {sorted.map((w) => (
                <span
                  key={w}
                  className="px-2 py-1 rounded-md bg-slate-800/70 border border-slate-700 text-sm uppercase font-mono"
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-slate-500 mb-10">No words this round.</p>
        )}

        <div className="flex flex-col gap-3 max-w-sm w-full mt-auto">
          <button
            type="button"
            onClick={handleShare}
            disabled={!canShare}
            className="py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            📤 Share result
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleGoHome}
              className="py-3 rounded-xl border border-slate-600 text-slate-300 active:scale-95 transition"
            >
              Home
            </button>
            {needsBuyReplay ? (
              <button
                type="button"
                onClick={handleBuyReplay}
                className="py-3 rounded-xl bg-amber-500 text-white font-semibold active:scale-95 transition"
              >
                Buy replay · {REPLAY_PRICE_STARS} ⭐
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartReplay}
                className="py-3 rounded-xl bg-purple-600 text-white font-semibold active:scale-95 transition"
              >
                {proActive
                  ? 'Play another'
                  : replayCredits !== null && replayCredits > 0
                    ? `Play replay (${replayCredits})`
                    : 'Play again'}
              </button>
            )}
          </div>
          {adReplayAvailable && (
            <button
              type="button"
              onClick={handleWatchAd}
              disabled={adInProgress}
              className="py-3 rounded-xl border border-amber-500/60 text-amber-300 font-medium active:scale-95 transition disabled:opacity-50"
            >
              {adInProgress
                ? 'Loading ad…'
                : `📺 Watch ad → free replay (${adsMaxPerDay - adsWatchedToday} left)`}
            </button>
          )}
          {adError && (
            <p className="text-xs text-rose-400 text-center">{adError}</p>
          )}
        </div>
      </div>
    </main>
  )
}

interface SubmitStatusBlockProps {
  status: 'idle' | 'submitting' | 'success' | 'error'
  error: string | null
  hasInitData: boolean
  onRetry: () => void
  onViewLeaderboard: () => void
}

function SubmitStatusBlock({
  status,
  error,
  hasInitData,
  onRetry,
  onViewLeaderboard,
}: SubmitStatusBlockProps) {
  if (!hasInitData) {
    return (
      <p className="mb-8 text-xs text-slate-500">
        Open in Telegram to save your score to the leaderboard.
      </p>
    )
  }

  if (status === 'submitting' || status === 'idle') {
    return <p className="mb-8 text-xs text-slate-400">Saving to leaderboard…</p>
  }

  if (status === 'success') {
    return (
      <div className="mb-8 flex flex-col items-center gap-2">
        <p className="text-xs text-emerald-400">Saved to leaderboard ✓</p>
        <button
          type="button"
          onClick={onViewLeaderboard}
          className="text-xs text-purple-300 underline active:scale-95 transition"
        >
          View top 100
        </button>
      </div>
    )
  }

  return (
    <div className="mb-8 flex flex-col items-center gap-2">
      <p className="text-xs text-rose-400">{describeError(error)}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs text-purple-300 underline active:scale-95 transition"
      >
        Retry
      </button>
    </div>
  )
}
