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
import { useViewportWidth } from '../hooks/useViewportWidth'
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
  const seed = useGameStore((s) => s.seed)
  const letters = useGameStore((s) => s.letters)
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled())
  const timeLeft = useTimeUntilMidnightUTC()
  const viewportWidth = useViewportWidth()
  // ROYALE — самое широкое слово, 6 букв × (7px + 1 gap) - 1 = 47px при scale=1.
  // Подбираем scale так, чтобы влезать в viewport с 18px padding-inline по бокам.
  // Дефолт scale=5 → 235px. На <= 360px (iPhone SE/old Android) даунгрейдим до 4.
  const logoScale = viewportWidth > 0 && viewportWidth <= 360 ? 4 : 5

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

  const playedToday = todayStatus.loaded ? todayStatus.playedToday : false
  const replayCredits = todayStatus.loaded ? todayStatus.replayCredits : 0
  const proActive = todayStatus.loaded && todayStatus.proActive
  const noFreeNoCredits = playedToday && replayCredits === 0 && !proActive
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
          minHeight: 28,
        }}
      >
        <StreakChip days={1} />
        {proActive ? <ProBadge /> : <span style={{ width: 1 }} />}
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
          <SaloonButton
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleBuyReplay}
          >
            Buy replay · {REPLAY_PRICE_STARS} ⭐
          </SaloonButton>
        ) : (
          <SaloonButton variant="primary" size="lg" fullWidth onClick={handlePlay}>
            {playLabel}
          </SaloonButton>
        )}
      </Card>

      {playedToday && !proActive && (
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
            : 'Buy a replay to play again.'}
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
        <button
          type="button"
          onClick={handleToggleSound}
          aria-pressed={soundOn}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-ash)',
            fontFamily: 'var(--font-pixel)',
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            padding: '4px 8px',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Sound · {soundOn ? 'On' : 'Off'}
        </button>
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
