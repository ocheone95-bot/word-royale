// Главный экран. Дизайн — saloon-at-night по handoff Claude Design.
// Mostaccio proud, PixelLogo, today's puzzle card с превью букв,
// большой Play CTA, нижний TabBar.
//
// Логика навигации/IAP/sound — без изменений с предыдущей версии.

import { useEffect, useState } from 'react'
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
import { hapticImpact } from '../lib/haptics'
import { isSoundEnabled, setSoundEnabled } from '../lib/sounds'
import { dayNumberSinceLaunch } from '../lib/day-number'
import { isMonetagAvailable } from '../lib/monetag'
import { useViewportWidth } from '../hooks/useViewportWidth'
import { useDayRollover } from '../hooks/useDayRollover'
import { Mostaccio } from '../components/Mostaccio'
import { PixelLogo } from '../components/PixelLogo'
import {
  Card,
  LetterTile,
  ProBadge,
  SaloonButton,
  StreakChip,
  TabBar,
  type TabKey,
} from '../components/saloon'

const REPLAY_PRICE_STARS = 50

function weekdayLabel(seed: string): string {
  const d = new Date(seed + 'T00:00:00Z')
  return d
    .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
    .toUpperCase()
}

function useTimeUntilMidnightUTC(): string {
  const [label, setLabel] = useState(() => buildLabel())
  useEffect(() => {
    const id = setInterval(() => setLabel(buildLabel()), 60_000)
    return () => clearInterval(id)
  }, [])
  return label
}

function buildLabel(): string {
  const now = new Date()
  const next = new Date(now)
  next.setUTCHours(24, 0, 0, 0)
  const ms = next.getTime() - now.getTime()
  const totalMin = Math.max(0, Math.floor(ms / 60_000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${m.toString().padStart(2, '0')}m left`
}

export default function HomeScreen() {
  const user = useTelegramUser()
  const initData = useRawInitData()
  const startGame = useGameStore((s) => s.startGame)
  const showLeaderboard = useGameStore((s) => s.showLeaderboard)
  const showShop = useGameStore((s) => s.showShop)
  const showMe = useGameStore((s) => s.showMe)
  const todayStatus = useGameStore((s) => s.todayStatus)
  const refreshTodayStatus = useGameStore((s) => s.refreshTodayStatus)
  const watchRewardedAd = useGameStore((s) => s.watchRewardedAd)
  const seed = useGameStore((s) => s.seed)
  const letters = useGameStore((s) => s.letters)
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled())
  const [adInProgress, setAdInProgress] = useState(false)
  const [adError, setAdError] = useState<string | null>(null)
  const timeLeft = useTimeUntilMidnightUTC()
  const viewportWidth = useViewportWidth()
  // ROYALE — самое широкое слово, 6 букв × (7px + 1 gap) - 1 = 47px при scale=1.
  // Подбираем scale так, чтобы влезать в viewport с 18px padding-inline по бокам.
  // Дефолт scale=5 → 235px. На <= 360px (iPhone SE/old Android) даунгрейдим до 4.
  const logoScale = viewportWidth > 0 && viewportWidth <= 360 ? 4 : 5

  useEffect(() => {
    if (!initData) return
    void refreshTodayStatus(initData)
  }, [initData, refreshTodayStatus])
  useDayRollover(initData ?? undefined)

  const playedToday = todayStatus.loaded ? todayStatus.playedToday : false
  const replayCredits = todayStatus.loaded ? todayStatus.replayCredits : 0
  const proActive = todayStatus.loaded && todayStatus.proActive
  const adsWatchedToday = todayStatus.loaded ? todayStatus.adsWatchedToday : 0
  const adsMaxPerDay = todayStatus.loaded ? todayStatus.adsMaxPerDay : 0
  const noFreeNoCredits = playedToday && replayCredits === 0 && !proActive
  const adReplayAvailable =
    noFreeNoCredits &&
    isMonetagAvailable() &&
    adsMaxPerDay > 0 &&
    adsWatchedToday < adsMaxPerDay
  const playLabel = proActive
    ? playedToday
      ? '▶ Play another'
      : '▶ Play'
    : !playedToday
      ? '▶ Play'
      : replayCredits > 0
        ? `▶ Play replay (${replayCredits})`
        : '▶ Play'

  const handlePlay = () => {
    hapticImpact('medium')
    startGame()
  }
  const handleBuyReplay = () => {
    hapticImpact('medium')
    track('iap_initiated', {
      product_id: 'replay',
      price_stars: REPLAY_PRICE_STARS,
      source: 'home',
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
  const handleInvite = () => {
    hapticImpact('light')
    track('invite_clicked')
    const url = buildPlayDeepLink(user?.id ?? null)
    openTelegramLink(buildTelegramShareLink(buildInviteText(), url))
  }
  const handleToggleSound = () => {
    const next = !soundOn
    setSoundEnabled(next)
    setSoundOn(next)
    hapticImpact('light')
    track('sound_toggled', { enabled: next })
  }
  const handleTabChange = (key: TabKey) => {
    if (key === 'home') return
    hapticImpact('light')
    if (key === 'board') showLeaderboard()
    else if (key === 'shop') showShop()
    else if (key === 'me') showMe()
  }

  const day = dayNumberSinceLaunch(seed)

  return (
    <main
      style={{
        minHeight: '100vh',
        position: 'relative',
        background: 'var(--gradient-page)',
        color: 'var(--text-parchment)',
        paddingInline: 18,
        paddingTop: 14,
        paddingBottom: 100,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 32,
        }}
      >
        <StreakChip days={1} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {proActive && <ProBadge />}
          <button
            type="button"
            onClick={handleToggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? 'Sound on' : 'Sound off'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              background: soundOn
                ? 'rgba(212,168,73,0.18)'
                : 'rgba(0,0,0,0.35)',
              border: `1px solid ${
                soundOn ? 'rgba(212,168,73,0.55)' : 'rgba(244,228,188,0.18)'
              }`,
              borderRadius: 8,
              boxShadow: soundOn ? '0 0 8px rgba(212,168,73,0.3)' : 'none',
              color: soundOn
                ? 'var(--accent-brass-hi)'
                : 'var(--text-parchment-dim)',
              fontFamily: 'var(--font-pixel)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              lineHeight: 1,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              minHeight: 32,
            }}
          >
            <SpeakerIcon on={soundOn} />
            {soundOn ? 'On' : 'Off'}
          </button>
        </div>
      </header>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: 22,
          gap: 4,
        }}
      >
        <PixelLogo text="WORD" scale={logoScale} color="#ff8c42" glow="#ff8c42" />
        <PixelLogo
          text="ROYALE"
          scale={logoScale}
          color="#f4e4bc"
          glow="#ff8c42"
          glowStrength="md"
        />
        <p
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 11,
            color: 'var(--text-ash)',
            letterSpacing: 2,
            marginTop: 6,
            textTransform: 'uppercase',
          }}
        >
          Day {day} · {weekdayLabel(seed)}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: 14,
        }}
      >
        <Mostaccio pose="proud" scale={3.5} />
      </div>

      <Card surface="table" padding={14} style={{ marginTop: 16 }}>
        <div
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 11,
            color: 'var(--accent-brass)',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          {user?.firstName ? `Hi, ${user.firstName}` : "Today's puzzle"}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginTop: 4,
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 400,
              color: 'var(--text-parchment)',
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            The Saloon
          </h2>
          <span
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 12,
              color: 'var(--text-parchment-dim)',
            }}
          >
            {timeLeft}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 5,
            marginTop: 14,
            marginBottom: 14,
            flexWrap: 'wrap',
          }}
        >
          {letters.map((l, i) => (
            <LetterTile key={i} letter={l} size={32} />
          ))}
        </div>

        {noFreeNoCredits ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SaloonButton
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleBuyReplay}
            >
              Buy replay · {REPLAY_PRICE_STARS} ⭐
            </SaloonButton>
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
                  : `Watch ad → free replay (${adsMaxPerDay - adsWatchedToday} left)`}
              </SaloonButton>
            )}
          </div>
        ) : (
          <SaloonButton variant="primary" size="lg" fullWidth onClick={handlePlay}>
            {playLabel}
          </SaloonButton>
        )}
      </Card>

      {adError && (
        <p
          style={{
            fontSize: 11,
            color: '#ff5a3d',
            marginTop: 10,
            textAlign: 'center',
          }}
        >
          {adError}
        </p>
      )}

      {playedToday && !proActive && !adError && (
        <p
          style={{
            fontSize: 11,
            color: 'var(--text-parchment-dim)',
            marginTop: 10,
            textAlign: 'center',
          }}
        >
          You already played today.{' '}
          {replayCredits > 0
            ? `${replayCredits} replay${replayCredits === 1 ? '' : 's'} ready.`
            : 'Buy a replay or watch an ad to play again.'}
        </p>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginTop: 18,
          alignItems: 'center',
        }}
      >
        <SaloonButton
          variant="secondary"
          size="sm"
          onClick={handleInvite}
          style={{
            borderColor: 'var(--accent-brass)',
            color: 'var(--accent-brass-hi)',
          }}
        >
          Invite friends
        </SaloonButton>
      </div>

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 24,
          paddingInline: 18,
        }}
      >
        <Card surface="table" padding={4} bordered>
          <TabBar active="home" onChange={handleTabChange} />
        </Card>
      </div>
    </main>
  )
}

// Маленькая SVG-иконка динамика (12×12). Когда звук выкл — рисуем
// strike-through, чтобы было сразу понятно без чтения текста рядом.
function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path
        d="M2 4.5 L4 4.5 L7 2 L7 10 L4 7.5 L2 7.5 Z"
        fill="currentColor"
      />
      {on ? (
        <>
          <path
            d="M8.5 4.5 Q9.5 6 8.5 7.5"
            stroke="currentColor"
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : (
        <line
          x1="8"
          y1="3.5"
          x2="11"
          y2="8.5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}
