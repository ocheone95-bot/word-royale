// Экран итогов партии. Saloon-redesign: trophy/blanket Mostaccio в зависимости
// от результата, big tick-up счёт в pixel font, stats card, primary CTA
// зависит от состояния (Share / Buy replay / Watch ad). Сохраняет всю
// существующую логику submit-score / share / replay / ad.

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
import { dayNumberSinceLaunch } from '../lib/day-number'
import { useTickUp } from '../hooks/useTickUp'
import { Mostaccio } from '../components/Mostaccio'
import { Card, SaloonButton, Scanlines } from '../components/saloon'

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

// Текст награды в pixel-стиле, без эмоджи. Внутри карточки — крупный
// «N day streak» в font-display и подпись с конкретной наградой.
function describeStreakReward(
  milestone: number,
  reward: string | null,
): { headline: string; reward: string } | null {
  if (milestone <= 0) return null
  const label = `${milestone} day streak`
  if (reward === 'replay_credit') {
    return { headline: label, reward: '+1 free replay credit' }
  }
  if (reward === 'theme_neon') {
    return { headline: label, reward: 'Free theme unlocked: NEON' }
  }
  if (reward === 'pro_30d') {
    return { headline: label, reward: 'Word Pro for 30 days' }
  }
  // milestone достигнут, но RPC не вернула награду (race) — всё равно
  // показываем поздравление; ресет на следующем входе через refreshTodayStatus.
  return { headline: label, reward: 'Reward delivered' }
}

export default function ResultScreen() {
  const score = useGameStore((s) => s.score)
  const serverScore = useGameStore((s) => s.serverScore)
  const doubleScoreApplied = useGameStore((s) => s.doubleScoreApplied)
  const streakMilestoneReached = useGameStore((s) => s.streakMilestoneReached)
  const streakReward = useGameStore((s) => s.streakReward)
  const foundWords = useGameStore((s) => s.foundWords)
  const seed = useGameStore((s) => s.seed)
  const startGame = useGameStore((s) => s.startGame)
  const goHome = useGameStore((s) => s.goHome)
  const showLeaderboard = useGameStore((s) => s.showLeaderboard)
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

  const displayScore = serverScore ?? score
  const animatedScore = useTickUp(displayScore, 800)
  const longest = foundWords.reduce((a, b) => (b.length > a.length ? b : a), '')

  const knowStatus = todayStatus.loaded
  const replayCredits = knowStatus ? todayStatus.replayCredits : null
  const proActive = knowStatus && todayStatus.proActive
  const adsWatchedToday = knowStatus ? todayStatus.adsWatchedToday : 0
  const adsMaxPerDay = knowStatus ? todayStatus.adsMaxPerDay : 0
  const needsBuyReplay = knowStatus && replayCredits === 0 && !proActive
  const adReplayAvailable =
    needsBuyReplay &&
    isMonetagAvailable() &&
    adsMaxPerDay > 0 &&
    adsWatchedToday < adsMaxPerDay

  const handleStartReplay = () => {
    hapticImpact('medium')
    startGame()
  }
  const handleGoHome = () => {
    hapticImpact('light')
    goHome()
  }
  const handleShowLeaderboard = () => {
    hapticImpact('medium')
    showLeaderboard()
  }
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
  }

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
      dayNumber: dayNumberSinceLaunch(seed),
    })
    const url = buildPlayDeepLink(tgUser?.id ?? null)
    openTelegramLink(buildTelegramShareLink(text, url))
  }

  // Тёплая поза кота для хорошего результата, blanket для слабого.
  // Milestone-streak важнее оценки скора — даже слабая партия в день стрика
  // должна выглядеть как победа, поэтому переключаем на trophy.
  const goodResult = displayScore >= 200 && foundWords.length >= 3
  const streakInfo = describeStreakReward(streakMilestoneReached, streakReward)
  const catPose = streakInfo
    ? 'trophy'
    : goodResult
      ? 'trophy'
      : foundWords.length === 0
        ? 'blanket'
        : 'proud'

  return (
    <main
      style={{
        minHeight: '100vh',
        position: 'relative',
        background:
          'radial-gradient(circle at 50% 25%, var(--tint-page) 0%, transparent 55%), var(--bg-room)',
        color: 'var(--text-parchment)',
        paddingInline: 18,
        paddingTop: 14,
        paddingBottom: 36,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Scanlines enabled opacity={0.08} />

      <header
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <button
          type="button"
          onClick={handleGoHome}
          aria-label="Close"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-parchment-dim)',
            fontFamily: 'var(--font-pixel)',
            fontSize: 22,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            padding: 6,
          }}
        >
          ×
        </button>
      </header>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
        <span
          style={{
            display: 'inline-block',
            background: 'var(--accent-lamp)',
            color: 'var(--text-charcoal)',
            padding: '4px 14px',
            borderRadius: 999,
            fontFamily: 'var(--font-pixel)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: 'uppercase',
            boxShadow: '0 0 16px rgba(255,140,66,0.65)',
          }}
        >
          Round over
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
        <Mostaccio pose={catPose} scale={3.5} />
      </div>

      <p
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 11,
          color: 'var(--text-ash)',
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginTop: 12,
          marginBottom: 0,
          textAlign: 'center',
        }}
      >
        Final score
      </p>
      <h1
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 64,
          fontWeight: 700,
          color: 'var(--glow-pixel)',
          textShadow: '0 0 8px var(--glow-pixel), 0 0 22px var(--accent-lamp)',
          margin: '4px 0 0',
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {animatedScore.toLocaleString()}
      </h1>

      {doubleScoreApplied && (
        <p
          style={{
            textAlign: 'center',
            marginTop: 4,
            fontSize: 10,
            fontFamily: 'var(--font-pixel)',
            color: 'var(--accent-brass-hi)',
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          ×2 boost applied
        </p>
      )}

      {streakInfo && (
        <Card
          surface="leather"
          padding={12}
          style={{
            marginTop: 14,
            border: '1.5px solid var(--accent-brass)',
            boxShadow:
              '0 0 18px rgba(212,168,73,0.35), inset 0 0 12px rgba(255,140,66,0.1)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 10,
              letterSpacing: 2,
              color: 'var(--accent-brass-hi)',
              textTransform: 'uppercase',
            }}
          >
            ♛ Streak reward
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              color: 'var(--accent-lamp)',
              marginTop: 4,
              textShadow: '0 0 10px rgba(255,140,66,0.55)',
            }}
          >
            {streakInfo.headline}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-parchment)',
              marginTop: 6,
            }}
          >
            {streakInfo.reward}
          </div>
        </Card>
      )}

      <Card surface="table" padding={14} style={{ marginTop: 16 }}>
        <StatRow label="Words found" value={String(foundWords.length)} />
        {longest && (
          <StatRow
            label="Best word"
            value={longest.toUpperCase()}
            highlight
          />
        )}
        <StatRow label="Longest" value={`${longest.length || 0} letters`} />
      </Card>

      <SubmitStatusBlock
        status={submitStatus}
        error={submitError}
        hasInitData={Boolean(initData)}
        onRetry={() => {
          hapticImpact('light')
          if (initData) void submitCurrentSession(initData)
        }}
      />

      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          paddingTop: 24,
        }}
      >
        <SaloonButton
          variant="primary"
          size="md"
          fullWidth
          onClick={handleShare}
          disabled={!canShare}
        >
          Share result
        </SaloonButton>
        <div style={{ display: 'flex', gap: 10 }}>
          <SaloonButton
            variant="secondary"
            size="md"
            onClick={handleGoHome}
            style={{ flex: 1 }}
          >
            Home
          </SaloonButton>
          {needsBuyReplay ? (
            <SaloonButton
              variant="primary"
              size="md"
              onClick={handleBuyReplay}
              style={{ flex: 1.4 }}
            >
              Buy replay · {REPLAY_PRICE_STARS} ⭐
            </SaloonButton>
          ) : (
            <SaloonButton
              variant="primary"
              size="md"
              onClick={handleStartReplay}
              style={{ flex: 1.4 }}
            >
              {proActive
                ? 'Play another'
                : replayCredits !== null && replayCredits > 0
                  ? `Play replay (${replayCredits})`
                  : 'Play again'}
            </SaloonButton>
          )}
        </div>
        {adReplayAvailable && (
          <SaloonButton
            variant="secondary"
            size="sm"
            fullWidth
            onClick={handleWatchAd}
            disabled={adInProgress}
          >
            {adInProgress
              ? 'Loading ad…'
              : 'Watch ad → free replay'}
          </SaloonButton>
        )}
        {adError && (
          <p
            style={{
              fontSize: 11,
              color: '#ff5a3d',
              textAlign: 'center',
            }}
          >
            {adError}
          </p>
        )}
        <button
          type="button"
          onClick={handleShowLeaderboard}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent-brass-hi)',
            fontFamily: 'var(--font-ui)',
            fontSize: 13,
            fontWeight: 700,
            padding: '8px 12px',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            marginTop: 4,
          }}
        >
          ♛ View leaderboard
        </button>
      </div>
    </main>
  )
}

function StatRow({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '6px 0',
        borderBottom: '1px dashed rgba(244,228,188,0.08)',
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: 'var(--text-parchment-dim)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 14,
          fontWeight: 700,
          color: highlight ? 'var(--accent-lamp)' : 'var(--text-parchment)',
          textShadow: highlight ? '0 0 8px rgba(255,140,66,0.5)' : 'none',
          letterSpacing: highlight ? 1.5 : 0,
        }}
      >
        {value}
      </span>
    </div>
  )
}

interface SubmitStatusBlockProps {
  status: 'idle' | 'submitting' | 'success' | 'error'
  error: string | null
  hasInitData: boolean
  onRetry: () => void
}

function SubmitStatusBlock({
  status,
  error,
  hasInitData,
  onRetry,
}: SubmitStatusBlockProps) {
  if (!hasInitData) {
    return (
      <p
        style={{
          marginTop: 14,
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--text-ash)',
        }}
      >
        Open in Telegram to save your score to the leaderboard.
      </p>
    )
  }

  if (status === 'submitting' || status === 'idle') {
    return (
      <p
        style={{
          marginTop: 14,
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--text-parchment-dim)',
        }}
      >
        Saving to leaderboard…
      </p>
    )
  }

  if (status === 'success') {
    return (
      <p
        style={{
          marginTop: 14,
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--accent-brass-hi)',
        }}
      >
        ✓ Saved to leaderboard
      </p>
    )
  }

  return (
    <div
      style={{
        marginTop: 14,
        textAlign: 'center',
      }}
    >
      <p style={{ fontSize: 11, color: '#ff5a3d', margin: 0 }}>
        {describeError(error)}
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--accent-lamp)',
          fontSize: 11,
          fontFamily: 'var(--font-ui)',
          fontWeight: 700,
          textDecoration: 'underline',
          marginTop: 4,
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  )
}
