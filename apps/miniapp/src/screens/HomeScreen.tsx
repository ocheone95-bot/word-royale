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
import { getLang, t, tPlural, useLang } from '../lib/i18n'
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

const WEEKDAY_KEYS = [
  'weekday.SUNDAY',
  'weekday.MONDAY',
  'weekday.TUESDAY',
  'weekday.WEDNESDAY',
  'weekday.THURSDAY',
  'weekday.FRIDAY',
  'weekday.SATURDAY',
] as const

function weekdayLabel(seed: string): string {
  const d = new Date(seed + 'T00:00:00Z')
  return t(WEEKDAY_KEYS[d.getUTCDay()])
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
  return t('time.h_m_left', {
    h,
    m: m.toString().padStart(2, '0'),
  })
}

export default function HomeScreen() {
  useLang()
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
  const proExpiresAt = todayStatus.loaded ? todayStatus.proExpiresAt : null
  const proTrialActive = todayStatus.loaded && todayStatus.proTrialActive
  const adsWatchedToday = todayStatus.loaded ? todayStatus.adsWatchedToday : 0
  const adsMaxPerDay = todayStatus.loaded ? todayStatus.adsMaxPerDay : 0
  const currentStreak = todayStatus.loaded ? todayStatus.currentStreak : 0
  const weeklyRank = todayStatus.loaded ? todayStatus.weeklyRank : null
  const weekEnd = todayStatus.loaded ? todayStatus.weekEnd : ''
  const noFreeNoCredits = playedToday && replayCredits === 0 && !proActive
  const adReplayAvailable =
    noFreeNoCredits &&
    isMonetagAvailable() &&
    adsMaxPerDay > 0 &&
    adsWatchedToday < adsMaxPerDay
  const playLabel = proActive
    ? playedToday
      ? t('home.play_another')
      : t('home.play')
    : !playedToday
      ? t('home.play')
      : replayCredits > 0
        ? t('home.play_replay', { n: replayCredits })
        : t('home.play')

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
        res.reason === 'limit' ? t('home.ad_limit') : t('home.ad_unavailable'),
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
        {currentStreak > 0 ? <StreakChip days={currentStreak} /> : <span />}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {proTrialActive ? (
            <ProTrialPill expiresAt={proExpiresAt} />
          ) : (
            proActive && <ProBadge />
          )}
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
            {soundOn ? t('home.sound_on') : t('home.sound_off')}
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
          {t('home.day_label', { n: day, weekday: weekdayLabel(seed) })}
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
          {user?.firstName
            ? t('home.greeting', { name: user.firstName })
            : t('home.todays_puzzle')}
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
            {t('home.saloon_title')}
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
            marginBottom: getLang() === 'ru' ? 6 : 14,
            flexWrap: 'wrap',
          }}
        >
          {letters.map((l, i) => (
            <LetterTile key={i} letter={l} size={32} />
          ))}
        </div>
        {getLang() === 'ru' && (
          <p
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 10,
              color: 'var(--text-ash)',
              letterSpacing: 1,
              textAlign: 'center',
              margin: '0 0 12px 0',
              lineHeight: 1.3,
            }}
          >
            {t('home.english_letters_hint')}
          </p>
        )}

        {noFreeNoCredits ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SaloonButton
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleBuyReplay}
            >
              {t('home.buy_replay', { price: REPLAY_PRICE_STARS })}
            </SaloonButton>
            {adReplayAvailable && (
              <SaloonButton
                variant="secondary"
                size="sm"
                fullWidth
                onClick={handleWatchAd}
                disabled={adInProgress}
              >
                {adInProgress ? t('home.ad_loading') : t('home.watch_ad')}
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
          {replayCredits > 0
            ? tPlural('home.played_today_credits', replayCredits)
            : t('home.played_today_no_credits')}
        </p>
      )}

      {weeklyRank !== null && weeklyRank <= 100 && (
        <WeeklyRankStrip
          rank={weeklyRank}
          weekEnd={weekEnd}
          onClick={() => {
            hapticImpact('light')
            showLeaderboard()
          }}
        />
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
          {t('home.invite_friends')}
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

// Полоса «You're #N this week — Xd Yh left». Кликабельная — ведёт на
// LeaderboardScreen с активным WEEK табом. Видна только если юзер уже
// в топ-100 текущего турнира.
function WeeklyRankStrip({
  rank,
  weekEnd,
  onClick,
}: {
  rank: number
  weekEnd: string
  onClick: () => void
}) {
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const remaining = (() => {
    if (!weekEnd) return ''
    const ends = new Date(`${weekEnd}T00:00:00Z`).getTime()
    const ms = ends - Date.now()
    if (ms <= 0) return ''
    const totalMin = Math.floor(ms / 60_000)
    const days = Math.floor(totalMin / (24 * 60))
    const hours = Math.floor((totalMin - days * 24 * 60) / 60)
    if (days >= 1) return t('time.d_h_left', { d: days, h: hours })
    return t('time.h_left', { h: hours })
  })()

  const prizeHint =
    rank <= 10 ? t('home.weekly_prize_top10') : t('home.weekly_prize_top100')

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        marginTop: 12,
        width: '100%',
        background: 'linear-gradient(180deg, var(--bg-leather) 0%, var(--bg-table) 100%)',
        border: '1px solid var(--accent-brass)',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 0 14px rgba(212,168,73,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
        color: 'var(--text-parchment)',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontWeight: 800,
              fontSize: 13,
              color: 'var(--accent-brass-hi)',
              letterSpacing: 0.4,
            }}
          >
            {t(rank <= 10 ? 'home.weekly_rank_top10' : 'home.weekly_rank_top100', { n: rank })}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 10,
              color: 'var(--text-ash)',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            {prizeHint}
            {remaining ? ` · ${remaining}` : ''}
          </span>
        </div>
        <span
          style={{
            color: 'var(--accent-lamp)',
            fontFamily: 'var(--font-pixel)',
            fontSize: 14,
          }}
        >
          ›
        </span>
      </div>
    </button>
  )
}

// Pill для Pro free trial: «Pro trial · Xh Ym left». Brass-glow как у
// ProBadge, но с явным countdown — толкает юзера купить до истечения.
// Если осталось < 1 минуты, показываем «expiring», без отрицательных значений.
function ProTrialPill({ expiresAt }: { expiresAt: string | null }) {
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  if (!expiresAt) return null
  const diff = new Date(expiresAt).getTime() - Date.now()
  const totalMin = Math.max(0, Math.floor(diff / 60_000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const label =
    totalMin <= 0
      ? t('time.expiring')
      : h > 0
        ? t('time.h_m_left', { h, m: m.toString().padStart(2, '0') })
        : t('time.h_m_left', { h: 0, m: m.toString().padStart(2, '0') })
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        background: 'rgba(212,168,73,0.18)',
        border: '1px solid var(--accent-brass)',
        borderRadius: 999,
        boxShadow: '0 0 10px rgba(212,168,73,0.35)',
        color: 'var(--accent-brass-hi)',
        fontFamily: 'var(--font-pixel)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        lineHeight: 1,
      }}
    >
      <span style={{ color: 'var(--accent-lamp)' }}>♛</span>
      {t('badge.pro_trial', { time: label })}
    </span>
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
