// Профиль игрока. Показывает текущий статус юзера на сегодня
// (replay credits, double score boost, Pro-подписка, темы, реклама)
// и lifetime stats (best score, total games, streak, longest word).
// Источники данных:
//   - todayStatus из useGameStore (refresh при mount/visibility) — для блока Today
//   - fetchMeStats Edge Function — для блока All-time, лениво, при mount.

import { useEffect, useState } from 'react'
import { useRawInitData } from '@telegram-apps/sdk-react'
import { useGameStore } from '../store/useGameStore'
import { useTelegramUser } from '../hooks/useTelegramUser'
import { hapticImpact } from '../lib/haptics'
import { useDayRollover } from '../hooks/useDayRollover'
import { fetchMeStats, type MeStats } from '../lib/api'
import { captureMessage } from '../lib/sentry'
import { buildFeedbackDeepLink } from '../lib/feedback'
import { openTelegramLink } from '../lib/telegram'
import { track } from '../lib/analytics'
import { Mostaccio } from '../components/Mostaccio'
import {
  Card,
  ProBadge,
  SaloonButton,
  TabBar,
  type TabKey,
} from '../components/saloon'
import { getLang, setLang, t, tPlural, useLang, type Lang } from '../lib/i18n'

function formatProExpiry(iso: string | null, lang: Lang): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export default function MeScreen() {
  const lang = useLang()
  const initData = useRawInitData()
  const tgUser = useTelegramUser()
  const goHome = useGameStore((s) => s.goHome)
  const showLeaderboard = useGameStore((s) => s.showLeaderboard)
  const showShop = useGameStore((s) => s.showShop)
  const todayStatus = useGameStore((s) => s.todayStatus)
  const refreshTodayStatus = useGameStore((s) => s.refreshTodayStatus)
  const [statsState, setStatsState] = useState<
    { kind: 'loading' } | { kind: 'loaded'; stats: MeStats } | { kind: 'error' }
  >({ kind: 'loading' })

  useEffect(() => {
    if (!initData) return
    void refreshTodayStatus(initData)
  }, [initData, refreshTodayStatus])
  useDayRollover(initData ?? undefined)

  useEffect(() => {
    if (!initData) return
    let cancelled = false
    setStatsState({ kind: 'loading' })
    void fetchMeStats(initData).then((res) => {
      if (cancelled) return
      if (res.ok) {
        setStatsState({
          kind: 'loaded',
          stats: {
            bestScore: res.bestScore,
            totalGames: res.totalGames,
            daysPlayed: res.daysPlayed,
            currentStreak: res.currentStreak,
            bestStreak: res.bestStreak,
            totalWordsFound: res.totalWordsFound,
            longestWord: res.longestWord,
          },
        })
      } else {
        if (!res.error.startsWith('network')) {
          captureMessage('me-stats failed', { error: res.error })
        }
        setStatsState({ kind: 'error' })
      }
    })
    return () => {
      cancelled = true
    }
  }, [initData])

  const playedToday = todayStatus.loaded && todayStatus.playedToday
  const replayCredits = todayStatus.loaded ? todayStatus.replayCredits : 0
  const themes = todayStatus.loaded ? todayStatus.themes : []
  const themesOwned = themes.length
  const doubleScoreActive = todayStatus.loaded && todayStatus.doubleScoreActive
  const proActive = todayStatus.loaded && todayStatus.proActive
  const proExpiresAt = todayStatus.loaded ? todayStatus.proExpiresAt : null
  const proTrialActive = todayStatus.loaded && todayStatus.proTrialActive
  const adsWatchedToday = todayStatus.loaded ? todayStatus.adsWatchedToday : 0
  const adsMaxPerDay = todayStatus.loaded ? todayStatus.adsMaxPerDay : 0

  const handleGoHome = () => {
    hapticImpact('light')
    goHome()
  }
  const handleOpenShop = () => {
    hapticImpact('light')
    showShop()
  }
  const handleOpenLeaderboard = () => {
    hapticImpact('light')
    showLeaderboard()
  }
  const handleSendFeedback = () => {
    hapticImpact('light')
    track('feedback_clicked')
    openTelegramLink(buildFeedbackDeepLink())
  }
  const handleTabChange = (key: TabKey) => {
    if (key === 'me') return
    hapticImpact('light')
    if (key === 'home') goHome()
    else if (key === 'board') showLeaderboard()
    else if (key === 'shop') showShop()
  }

  const displayName =
    tgUser?.firstName ||
    (tgUser?.username ? `@${tgUser.username}` : t('me.player_fallback'))
  const usernameLine = tgUser?.username ? `@${tgUser.username}` : null
  const mostacchioPose = proActive ? 'pro' : 'smile'

  return (
    <main
      style={{
        minHeight: '100vh',
        position: 'relative',
        background:
          'radial-gradient(circle at 50% 0%, var(--tint-page) 0%, transparent 45%), var(--bg-room)',
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
        }}
      >
        <button
          type="button"
          onClick={handleGoHome}
          aria-label="Back"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-parchment-dim)',
            fontSize: 22,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            padding: 6,
          }}
        >
          ‹
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 400,
            color: 'var(--text-parchment)',
            margin: 0,
          }}
        >
          {t('me.title')}
        </h1>
        <span style={{ width: 30 }} />
      </header>

      <Card surface="leather" padding={16} style={{ marginTop: 14 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div style={{ flexShrink: 0 }}>
            <Mostaccio pose={mostacchioPose} scale={2.5} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                color: 'var(--text-parchment)',
                lineHeight: 1.1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </div>
            {usernameLine && tgUser?.firstName && (
              <div
                style={{
                  fontFamily: 'var(--font-pixel)',
                  fontSize: 11,
                  color: 'var(--text-ash)',
                  letterSpacing: 1,
                  marginTop: 2,
                }}
              >
                {usernameLine}
              </div>
            )}
            {proActive && (
              <div style={{ marginTop: 8 }}>
                <ProBadge />
              </div>
            )}
          </div>
        </div>
      </Card>

      <SectionTitle>{t('me.section_today')}</SectionTitle>
      <Card surface="table" padding={4}>
        <StatRow
          label={t('me.todays_puzzle')}
          value={playedToday ? t('me.played') : t('me.not_yet')}
          highlight={!playedToday}
        />
        <StatRow
          label={t('me.replay_credits')}
          value={String(replayCredits)}
          highlight={replayCredits > 0}
        />
        <StatRow
          label={t('me.double_score_boost')}
          value={doubleScoreActive ? t('me.active') : t('me.dash')}
          highlight={doubleScoreActive}
        />
        <StatRow
          label={t('me.watch_ads')}
          value={
            adsMaxPerDay > 0
              ? `${adsWatchedToday} / ${adsMaxPerDay}`
              : t('me.dash')
          }
          divider={false}
        />
      </Card>

      <SectionTitle>{t('me.section_thisweek')}</SectionTitle>
      <Card surface="table" padding={4}>
        <StatRow
          label={t('me.tournament_rank')}
          value={
            todayStatus.loaded && todayStatus.weeklyRank !== null
              ? `#${todayStatus.weeklyRank}`
              : t('me.dash')
          }
          highlight={
            todayStatus.loaded &&
            todayStatus.weeklyRank !== null &&
            todayStatus.weeklyRank <= 100
          }
        />
        <StatRow
          label={t('me.total_score')}
          value={
            todayStatus.loaded && todayStatus.weeklyTotalScore !== null
              ? todayStatus.weeklyTotalScore.toLocaleString()
              : t('me.dash')
          }
          divider={false}
        />
      </Card>

      <SectionTitle>{t('me.section_membership')}</SectionTitle>
      <Card surface="table" padding={4}>
        <StatRow
          label={t('me.word_pro')}
          value={
            proTrialActive
              ? t('me.trial_until', {
                  date: formatProExpiry(proExpiresAt, lang),
                })
              : proActive
                ? t('me.until', { date: formatProExpiry(proExpiresAt, lang) })
                : t('me.free_tier')
          }
          highlight={proActive}
        />
        <StatRow
          label={t('me.themes_owned')}
          value={
            proActive
              ? t('me.themes_all_pro')
              : t('me.themes_count', { n: themesOwned })
          }
          highlight={themesOwned > 0 || proActive}
          divider={false}
        />
      </Card>

      <SectionTitle>{t('me.section_alltime')}</SectionTitle>
      <Card surface="table" padding={4}>
        {statsState.kind === 'loading' && (
          <p
            style={{
              padding: '14px 12px',
              fontSize: 12,
              textAlign: 'center',
              color: 'var(--text-parchment-dim)',
            }}
          >
            {t('common.loading')}
          </p>
        )}
        {statsState.kind === 'error' && (
          <p
            style={{
              padding: '14px 12px',
              fontSize: 12,
              textAlign: 'center',
              color: 'var(--text-ash)',
            }}
          >
            {t('me.could_not_load_stats')}
          </p>
        )}
        {statsState.kind === 'loaded' && (
          <>
            <StatRow
              label={t('me.best_score')}
              value={statsState.stats.bestScore.toLocaleString()}
              highlight={statsState.stats.bestScore > 0}
            />
            <StatRow
              label={t('me.games_played')}
              value={String(statsState.stats.totalGames)}
            />
            <StatRow
              label={t('me.days_played')}
              value={String(statsState.stats.daysPlayed)}
            />
            <StatRow
              label={t('me.current_streak')}
              value={
                statsState.stats.currentStreak === 0
                  ? t('me.dash')
                  : tPlural('me.day', statsState.stats.currentStreak)
              }
              highlight={statsState.stats.currentStreak >= 2}
            />
            <StatRow
              label={t('me.best_streak')}
              value={
                statsState.stats.bestStreak === 0
                  ? t('me.dash')
                  : tPlural('me.day', statsState.stats.bestStreak)
              }
              highlight={statsState.stats.bestStreak >= 3}
            />
            <StatRow
              label={t('me.words_found')}
              value={statsState.stats.totalWordsFound.toLocaleString()}
            />
            <StatRow
              label={t('me.longest_word')}
              value={
                statsState.stats.longestWord
                  ? statsState.stats.longestWord.toUpperCase()
                  : t('me.dash')
              }
              highlight={
                !!statsState.stats.longestWord &&
                statsState.stats.longestWord.length >= 5
              }
              divider={false}
            />
          </>
        )}
      </Card>

      <SectionTitle>{t('me.section_language')}</SectionTitle>
      <Card surface="table" padding={10}>
        <div style={{ display: 'flex', gap: 8 }}>
          <LangSegment
            active={lang === 'en'}
            onClick={() => {
              if (getLang() !== 'en') {
                hapticImpact('light')
                setLang('en')
              }
            }}
          >
            English
          </LangSegment>
          <LangSegment
            active={lang === 'ru'}
            onClick={() => {
              if (getLang() !== 'ru') {
                hapticImpact('light')
                setLang('ru')
              }
            }}
          >
            Русский
          </LangSegment>
        </div>
      </Card>

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginTop: 18,
        }}
      >
        <SaloonButton
          variant="secondary"
          size="md"
          onClick={handleOpenShop}
          style={{ flex: 1 }}
        >
          {t('me.open_shop')}
        </SaloonButton>
        <SaloonButton
          variant="secondary"
          size="md"
          onClick={handleOpenLeaderboard}
          style={{ flex: 1 }}
        >
          {t('me.leaderboard')}
        </SaloonButton>
      </div>

      <div style={{ marginTop: 10, display: 'flex' }}>
        <SaloonButton
          variant="ghost"
          size="sm"
          fullWidth
          onClick={handleSendFeedback}
        >
          {t('me.send_feedback')}
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
          <TabBar active="me" onChange={handleTabChange} />
        </Card>
      </div>
    </main>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2
      style={{
        fontFamily: 'var(--font-pixel)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 1.8,
        color: 'var(--accent-brass)',
        textTransform: 'uppercase',
        margin: '20px 0 8px 4px',
      }}
    >
      {children}
    </h2>
  )
}

function LangSegment({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        background: active ? 'var(--accent-lamp)' : 'var(--bg-leather)',
        color: active ? 'var(--text-charcoal)' : 'var(--text-parchment-dim)',
        border: '1px solid rgba(212,168,73,0.3)',
        padding: '10px 14px',
        borderRadius: 10,
        fontFamily: 'var(--font-ui)',
        fontWeight: 800,
        fontSize: 13,
        cursor: 'pointer',
        boxShadow: active ? '0 0 12px rgba(255,140,66,0.5)' : 'none',
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 120ms ease-out',
      }}
    >
      {children}
    </button>
  )
}

function StatRow({
  label,
  value,
  highlight = false,
  divider = true,
}: {
  label: string
  value: string
  highlight?: boolean
  divider?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '10px 12px',
        borderBottom: divider
          ? '1px dashed rgba(244,228,188,0.08)'
          : 'none',
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
          fontSize: 13,
          fontWeight: 700,
          color: highlight ? 'var(--accent-lamp)' : 'var(--text-parchment)',
          textShadow: highlight
            ? '0 0 8px rgba(255,140,66,0.5)'
            : 'none',
          letterSpacing: highlight ? 1.2 : 0,
        }}
      >
        {value}
      </span>
    </div>
  )
}
