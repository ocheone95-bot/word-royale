// Лидерборд: 3 режима — Friends / Global (за сегодняшний UTC-день) и Week
// (текущий weekly tournament). Saloon-redesign: scope toggle pill, top-3
// podium с brass-gold gradient у первого места, list rows с "you"-highlight
// через amber border + lamp-tinted bg.

import { useEffect, useMemo, useState } from 'react'
import { useRawInitData } from '@telegram-apps/sdk-react'
import {
  fetchDailyLeaderboard,
  fetchFriendsLeaderboard,
  fetchWeeklyLeaderboard,
  type LeaderboardEntry,
  type WeeklyEntry,
} from '../lib/api'
import { useGameStore } from '../store/useGameStore'
import { useTelegramUser } from '../hooks/useTelegramUser'
import {
  buildInviteText,
  buildPlayDeepLink,
  buildTelegramShareLink,
} from '../lib/share'
import { openTelegramLink } from '../lib/telegram'
import { hapticImpact } from '../lib/haptics'
import { useDayRollover } from '../hooks/useDayRollover'
import { Card, SaloonButton, TabBar, type TabKey } from '../components/saloon'
import { t, useLang } from '../lib/i18n'

type Mode = 'friends' | 'global' | 'week'

interface UiEntry {
  telegramId: number
  firstName: string | null
  username: string | null
  photoUrl: string | null
  score: number
  rank: number
  isSelf: boolean
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'loaded'; entries: UiEntry[]; meta?: WeekMeta }
  | { kind: 'error' }

interface WeekMeta {
  weekStart: string
  weekEnd: string
  selfRank: number | null
  selfTotalScore: number | null
}

function entryName(e: UiEntry): string {
  return (
    e.firstName ||
    (e.username ? `@${e.username}` : `${t('me.player_fallback')} ${e.telegramId}`)
  )
}

function fromDaily(entries: LeaderboardEntry[], meId: number | null): UiEntry[] {
  return entries.map((e, i) => ({
    telegramId: e.telegramId,
    firstName: e.firstName,
    username: e.username,
    photoUrl: e.photoUrl,
    score: e.score,
    rank: i + 1,
    isSelf: meId === e.telegramId,
  }))
}

function fromWeekly(entries: WeeklyEntry[]): UiEntry[] {
  return entries.map((e) => ({
    telegramId: e.telegramId,
    firstName: e.firstName,
    username: e.username,
    photoUrl: e.photoUrl,
    score: e.totalScore,
    rank: e.rank,
    isSelf: e.isSelf,
  }))
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  if (!weekStart || !weekEnd) return ''
  const start = new Date(`${weekStart}T00:00:00Z`)
  // weekEnd exclusive (Mon next), показываем последний день недели = Sun
  const end = new Date(`${weekEnd}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() - 1)
  const fmt = (d: Date): string =>
    `${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })} ${d.getUTCDate()}`
  return `${fmt(start)} – ${fmt(end)}`
}

function timeUntilWeekEnd(weekEnd: string): string {
  if (!weekEnd) return ''
  const ends = new Date(`${weekEnd}T00:00:00Z`).getTime()
  const remaining = ends - Date.now()
  if (remaining <= 0) return ''
  const totalMin = Math.floor(remaining / 60000)
  const days = Math.floor(totalMin / (24 * 60))
  const hours = Math.floor((totalMin - days * 24 * 60) / 60)
  if (days >= 1) return t('time.d_h_left', { d: days, h: hours })
  return t('time.h_left', { h: hours })
}

export default function LeaderboardScreen() {
  useLang()
  const goHome = useGameStore((s) => s.goHome)
  const showShop = useGameStore((s) => s.showShop)
  const showMe = useGameStore((s) => s.showMe)
  const seed = useGameStore((s) => s.seed)
  const tgUser = useTelegramUser()
  const initData = useRawInitData()
  const [mode, setMode] = useState<Mode>('friends')
  const [globalState, setGlobalState] = useState<LoadState>({ kind: 'loading' })
  const [friendsState, setFriendsState] = useState<LoadState>({ kind: 'loading' })
  const [weekState, setWeekState] = useState<LoadState>({ kind: 'loading' })

  useDayRollover(initData ?? undefined)

  useEffect(() => {
    let cancelled = false
    setGlobalState({ kind: 'loading' })
    fetchDailyLeaderboard(seed)
      .then((entries) => {
        if (!cancelled)
          setGlobalState({
            kind: 'loaded',
            entries: fromDaily(entries, tgUser?.id ?? null),
          })
      })
      .catch(() => {
        if (!cancelled) setGlobalState({ kind: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [seed, tgUser?.id])

  useEffect(() => {
    if (mode !== 'friends') return
    if (!initData) return
    let cancelled = false
    setFriendsState({ kind: 'loading' })
    fetchFriendsLeaderboard(initData, seed)
      .then((res) => {
        if (cancelled) return
        if (res.ok)
          setFriendsState({
            kind: 'loaded',
            entries: fromDaily(res.entries, tgUser?.id ?? null),
          })
        else setFriendsState({ kind: 'error' })
      })
      .catch(() => {
        if (!cancelled) setFriendsState({ kind: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [mode, initData, seed, tgUser?.id])

  useEffect(() => {
    if (mode !== 'week') return
    if (!initData) return
    let cancelled = false
    setWeekState({ kind: 'loading' })
    fetchWeeklyLeaderboard(initData, 'current')
      .then((res) => {
        if (cancelled) return
        if (res.ok) {
          setWeekState({
            kind: 'loaded',
            entries: fromWeekly(res.entries),
            meta: {
              weekStart: res.weekStart,
              weekEnd: res.weekEnd,
              selfRank: res.selfRank,
              selfTotalScore: res.selfTotalScore,
            },
          })
        } else setWeekState({ kind: 'error' })
      })
      .catch(() => {
        if (!cancelled) setWeekState({ kind: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [mode, initData])

  const state =
    mode === 'global' ? globalState : mode === 'week' ? weekState : friendsState

  const handleInvite = () => {
    hapticImpact('light')
    const url = buildPlayDeepLink(tgUser?.id ?? null)
    openTelegramLink(buildTelegramShareLink(buildInviteText(), url))
  }

  const handleGoHome = () => {
    hapticImpact('light')
    goHome()
  }

  const handleSetMode = (next: Mode) => {
    if (next !== mode) hapticImpact('light')
    setMode(next)
  }

  const handleTabChange = (key: TabKey) => {
    if (key === 'board') return
    hapticImpact('light')
    if (key === 'home') goHome()
    else if (key === 'shop') showShop()
    else if (key === 'me') showMe()
  }

  const headerLabel = useMemo(() => {
    if (mode !== 'week') return seed
    if (weekState.kind !== 'loaded' || !weekState.meta) return ''
    return formatWeekRange(weekState.meta.weekStart, weekState.meta.weekEnd)
  }, [mode, seed, weekState])

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
          {t('lb.title')}
        </h1>
        <span
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 11,
            color: 'var(--text-ash)',
            letterSpacing: 1,
          }}
        >
          {headerLabel}
        </span>
      </header>

      <div
        style={{
          display: 'inline-flex',
          alignSelf: 'center',
          marginTop: 12,
          background: 'var(--bg-table)',
          borderRadius: 999,
          padding: 4,
          border: '1px solid rgba(212,168,73,0.2)',
        }}
      >
        <ToggleSegment
          active={mode === 'friends'}
          onClick={() => handleSetMode('friends')}
        >
          {t('lb.friends')}
        </ToggleSegment>
        <ToggleSegment
          active={mode === 'global'}
          onClick={() => handleSetMode('global')}
        >
          {t('lb.global')}
        </ToggleSegment>
        <ToggleSegment
          active={mode === 'week'}
          onClick={() => handleSetMode('week')}
        >
          {t('lb.week')}
        </ToggleSegment>
      </div>

      {mode === 'week' && weekState.kind === 'loaded' && weekState.meta && (
        <WeekBanner meta={weekState.meta} />
      )}

      {state.kind === 'loading' && (
        <p
          style={{
            textAlign: 'center',
            marginTop: 40,
            color: 'var(--text-parchment-dim)',
            fontSize: 13,
          }}
        >
          {t('common.loading')}
        </p>
      )}

      {state.kind === 'error' && (
        <p
          style={{
            textAlign: 'center',
            marginTop: 40,
            color: '#ff5a3d',
            fontSize: 13,
          }}
        >
          {t('lb.could_not_load')}
        </p>
      )}

      {state.kind === 'loaded' && state.entries.length === 0 && (
        <EmptyState mode={mode} onInvite={handleInvite} />
      )}

      {state.kind === 'loaded' && state.entries.length >= 3 && (
        <Podium entries={state.entries.slice(0, 3)} mode={mode} />
      )}

      {state.kind === 'loaded' && state.entries.length > 0 && (
        <ol
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            margin: '20px 0 0',
            padding: 0,
            listStyle: 'none',
          }}
        >
          {(state.entries.length >= 3 ? state.entries.slice(3) : state.entries).map(
            (entry) => (
              <ListRow key={`${entry.telegramId}-${entry.rank}`} entry={entry} mode={mode} />
            ),
          )}
        </ol>
      )}

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
          <TabBar active="board" onChange={handleTabChange} />
        </Card>
      </div>
    </main>
  )
}

function ToggleSegment({
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
        background: active ? 'var(--accent-lamp)' : 'transparent',
        color: active ? 'var(--text-charcoal)' : 'var(--text-parchment-dim)',
        border: 'none',
        padding: '7px 18px',
        borderRadius: 999,
        fontFamily: 'var(--font-ui)',
        fontWeight: 800,
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
        boxShadow: active ? '0 0 12px rgba(255,140,66,0.6)' : 'none',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 120ms ease-out',
      }}
    >
      {children}
    </button>
  )
}

function WeekBanner({ meta }: { meta: WeekMeta }) {
  const remaining = timeUntilWeekEnd(meta.weekEnd)
  return (
    <div style={{ marginTop: 14 }}>
      <Card surface="leather" padding={12} bordered>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: 'var(--accent-brass)',
            }}
          >
            {t('lb.tournament_prizes')}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 12,
              color: 'var(--text-parchment)',
              fontWeight: 600,
            }}
          >
            {t('lb.prizes_summary')}
          </span>
          {remaining && (
            <span
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 11,
                color: 'var(--text-ash)',
                letterSpacing: 1,
              }}
            >
              {t('lb.ends_sunday', { time: remaining })}
            </span>
          )}
          {meta.selfRank !== null && (
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontWeight: 700,
                fontSize: 12,
                color: 'var(--accent-lamp)',
                marginTop: 4,
              }}
            >
              {t('lb.self_rank', {
                rank: meta.selfRank,
                pts: (meta.selfTotalScore ?? 0).toLocaleString(),
              })}
            </span>
          )}
        </div>
      </Card>
    </div>
  )
}

function Podium({
  entries,
  mode,
}: {
  entries: readonly UiEntry[]
  mode: Mode
}) {
  const [first, second, third] = entries
  const order: Array<{ entry: UiEntry; rank: 1 | 2 | 3 }> = [
    { entry: second, rank: 2 },
    { entry: first, rank: 1 },
    { entry: third, rank: 3 },
  ]
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: 8,
        marginTop: 24,
      }}
    >
      {order.map(({ entry, rank }) => (
        <PodiumColumn
          key={entry.telegramId}
          entry={entry}
          rank={rank}
          mode={mode}
        />
      ))}
    </div>
  )
}

function PodiumColumn({
  entry,
  rank,
  mode,
}: {
  entry: UiEntry
  rank: 1 | 2 | 3
  mode: Mode
}) {
  const barHeight = rank === 1 ? 84 : rank === 2 ? 60 : 48
  const barBg =
    rank === 1
      ? 'linear-gradient(180deg, var(--accent-brass-hi) 0%, var(--accent-brass) 100%)'
      : 'linear-gradient(180deg, var(--bg-leather) 0%, var(--bg-table) 100%)'
  const isFirst = rank === 1
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        flex: 1,
        maxWidth: 100,
      }}
    >
      <Avatar entry={entry} large={isFirst} />
      <span
        style={{
          fontSize: 11,
          color: entry.isSelf ? 'var(--accent-lamp)' : 'var(--text-parchment)',
          fontFamily: 'var(--font-ui)',
          fontWeight: 700,
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {entry.isSelf ? t('common.you') : entryName(entry)}
      </span>
      <span
        style={{
          fontSize: 13,
          fontFamily: 'var(--font-pixel)',
          color: 'var(--accent-brass)',
          fontWeight: 700,
        }}
      >
        {entry.score}
        {mode === 'week' && (
          <span
            style={{
              fontSize: 9,
              color: 'var(--text-ash)',
              marginLeft: 3,
              letterSpacing: 0.5,
            }}
          >
            {t('lb.pts')}
          </span>
        )}
      </span>
      <div
        style={{
          width: '100%',
          height: barHeight,
          background: barBg,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isFirst
            ? '0 0 14px rgba(212,168,73,0.5), inset 0 1px 0 rgba(255,255,255,0.25)'
            : 'inset 0 1px 0 rgba(255,255,255,0.06)',
          marginTop: 2,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 18,
            fontWeight: 700,
            color: isFirst ? 'var(--text-charcoal)' : 'var(--text-parchment-dim)',
          }}
        >
          {rank}
        </span>
      </div>
    </div>
  )
}

function Avatar({
  entry,
  large = false,
}: {
  entry: UiEntry
  large?: boolean
}) {
  const size = large ? 44 : 32
  const wrap: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: 'var(--bg-leather)',
    border: large ? '2px solid var(--accent-brass)' : '1px solid rgba(212,168,73,0.4)',
    boxShadow: large ? '0 0 10px rgba(212,168,73,0.5)' : 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    color: 'var(--text-parchment)',
    fontFamily: 'var(--font-ui)',
    fontWeight: 800,
    fontSize: large ? 18 : 14,
  }
  if (entry.photoUrl) {
    return (
      <span style={wrap}>
        <img
          src={entry.photoUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </span>
    )
  }
  const initial = entryName(entry).charAt(0).toUpperCase()
  return <span style={wrap}>{initial}</span>
}

function ListRow({ entry, mode }: { entry: UiEntry; mode: Mode }) {
  const isMe = entry.isSelf
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        borderRadius: 8,
        background: isMe ? 'rgba(255,140,66,0.14)' : 'var(--bg-leather)',
        borderLeft: isMe ? '3px solid var(--accent-lamp)' : '3px solid transparent',
      }}
    >
      <span
        style={{
          width: 24,
          textAlign: 'right',
          fontFamily: 'var(--font-pixel)',
          fontSize: 14,
          color: isMe ? 'var(--accent-lamp)' : 'var(--text-ash)',
        }}
      >
        {entry.rank}
      </span>
      <Avatar entry={entry} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--font-ui)',
          fontWeight: 700,
          fontSize: 13,
          color: isMe ? 'var(--accent-lamp)' : 'var(--text-parchment)',
        }}
      >
        {isMe ? 'You' : entryName(entry)}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--accent-brass)',
        }}
      >
        {entry.score}
        {mode === 'week' && (
          <span
            style={{
              fontSize: 9,
              color: 'var(--text-ash)',
              marginLeft: 3,
              letterSpacing: 0.5,
            }}
          >
            {t('lb.pts')}
          </span>
        )}
      </span>
    </li>
  )
}

function EmptyState({ mode, onInvite }: { mode: Mode; onInvite: () => void }) {
  if (mode === 'global') {
    return (
      <p
        style={{
          textAlign: 'center',
          marginTop: 40,
          color: 'var(--text-parchment-dim)',
          fontSize: 13,
        }}
      >
        {t('lb.empty_global')}
      </p>
    )
  }
  if (mode === 'week') {
    return (
      <p
        style={{
          textAlign: 'center',
          marginTop: 30,
          color: 'var(--text-parchment-dim)',
          fontSize: 13,
        }}
      >
        {t('lb.empty_week')}
      </p>
    )
  }
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: 40,
        gap: 14,
      }}
    >
      <p
        style={{
          textAlign: 'center',
          color: 'var(--text-parchment-dim)',
          fontSize: 13,
          maxWidth: 280,
        }}
      >
        {t('lb.empty_friends')}
      </p>
      <SaloonButton variant="primary" size="sm" onClick={onInvite}>
        {t('home.invite_friends')}
      </SaloonButton>
    </div>
  )
}
