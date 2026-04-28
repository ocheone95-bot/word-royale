// Лидерборд за сегодняшний UTC-день. Saloon-redesign: scope toggle pill,
// top-3 podium с brass-gold gradient у первого места, list rows с
// "you"-highlight через amber border + lamp-tinted bg.

import { useEffect, useState } from 'react'
import { useRawInitData } from '@telegram-apps/sdk-react'
import {
  fetchDailyLeaderboard,
  fetchFriendsLeaderboard,
  type LeaderboardEntry,
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

type Mode = 'friends' | 'global'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'loaded'; entries: LeaderboardEntry[] }
  | { kind: 'error' }

function entryName(e: LeaderboardEntry): string {
  return (
    e.firstName ||
    (e.username ? `@${e.username}` : `Player ${e.telegramId}`)
  )
}

export default function LeaderboardScreen() {
  const goHome = useGameStore((s) => s.goHome)
  const showShop = useGameStore((s) => s.showShop)
  const showMe = useGameStore((s) => s.showMe)
  const seed = useGameStore((s) => s.seed)
  const tgUser = useTelegramUser()
  const initData = useRawInitData()
  const [mode, setMode] = useState<Mode>('friends')
  const [globalState, setGlobalState] = useState<LoadState>({ kind: 'loading' })
  const [friendsState, setFriendsState] = useState<LoadState>({ kind: 'loading' })

  useDayRollover(initData ?? undefined)

  useEffect(() => {
    let cancelled = false
    setGlobalState({ kind: 'loading' })
    fetchDailyLeaderboard(seed)
      .then((entries) => {
        if (!cancelled) setGlobalState({ kind: 'loaded', entries })
      })
      .catch(() => {
        if (!cancelled) setGlobalState({ kind: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [seed])

  useEffect(() => {
    if (mode !== 'friends') return
    if (!initData) return
    let cancelled = false
    setFriendsState({ kind: 'loading' })
    fetchFriendsLeaderboard(initData, seed)
      .then((res) => {
        if (cancelled) return
        if (res.ok) setFriendsState({ kind: 'loaded', entries: res.entries })
        else setFriendsState({ kind: 'error' })
      })
      .catch(() => {
        if (!cancelled) setFriendsState({ kind: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [mode, initData, seed])

  const state = mode === 'global' ? globalState : friendsState

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
          Leaderboard
        </h1>
        <span
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 11,
            color: 'var(--text-ash)',
            letterSpacing: 1,
          }}
        >
          {seed}
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
          Friends
        </ToggleSegment>
        <ToggleSegment
          active={mode === 'global'}
          onClick={() => handleSetMode('global')}
        >
          Global
        </ToggleSegment>
      </div>

      {state.kind === 'loading' && (
        <p
          style={{
            textAlign: 'center',
            marginTop: 40,
            color: 'var(--text-parchment-dim)',
            fontSize: 13,
          }}
        >
          Loading…
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
          Could not load the leaderboard.
        </p>
      )}

      {state.kind === 'loaded' && state.entries.length === 0 && (
        <EmptyState mode={mode} onInvite={handleInvite} />
      )}

      {state.kind === 'loaded' && state.entries.length >= 3 && (
        <Podium
          entries={state.entries.slice(0, 3)}
          meId={tgUser?.id ?? null}
        />
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
            (entry, idx) => {
              const rank = state.entries.length >= 3 ? idx + 4 : idx + 1
              const isMe = tgUser?.id === entry.telegramId
              return <ListRow key={entry.telegramId} entry={entry} rank={rank} isMe={isMe} />
            },
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
        padding: '7px 22px',
        borderRadius: 999,
        fontFamily: 'var(--font-ui)',
        fontWeight: 800,
        fontSize: 13,
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

function Podium({
  entries,
  meId,
}: {
  entries: readonly LeaderboardEntry[]
  meId: number | null
}) {
  // Order on screen: 2nd (left) · 1st (center, taller) · 3rd (right)
  const [first, second, third] = entries
  const order: Array<{ entry: LeaderboardEntry; rank: 1 | 2 | 3 }> = [
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
          isMe={meId === entry.telegramId}
        />
      ))}
    </div>
  )
}

function PodiumColumn({
  entry,
  rank,
  isMe,
}: {
  entry: LeaderboardEntry
  rank: 1 | 2 | 3
  isMe: boolean
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
          color: isMe ? 'var(--accent-lamp)' : 'var(--text-parchment)',
          fontFamily: 'var(--font-ui)',
          fontWeight: 700,
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {isMe ? 'You' : entryName(entry)}
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
  entry: LeaderboardEntry
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

function ListRow({
  entry,
  rank,
  isMe,
}: {
  entry: LeaderboardEntry
  rank: number
  isMe: boolean
}) {
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
          width: 18,
          textAlign: 'right',
          fontFamily: 'var(--font-pixel)',
          fontSize: 14,
          color: isMe ? 'var(--accent-lamp)' : 'var(--text-ash)',
        }}
      >
        {rank}
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
        No scores yet today. Be the first.
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
        No friends here yet. Invite someone to play and you'll show up in each
        other's Friends leaderboard.
      </p>
      <SaloonButton variant="primary" size="sm" onClick={onInvite}>
        Invite friends
      </SaloonButton>
    </div>
  )
}
