// Лидерборд за сегодняшний UTC-день. Две вкладки:
//   - Global: топ-100 всех игроков мира (anon-чтение через Supabase Client).
//   - Friends: только игроки, связанные с текущим юзером в `referrals` в любую
//     сторону (через Edge Function friends-leaderboard).
// Текущий юзер подсвечен в обеих вкладках.

import { useEffect, useState } from 'react'
import { useRawInitData } from '@telegram-apps/sdk-react'
import { getTodaySeed } from '@word-royale/shared'
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

type Mode = 'global' | 'friends'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'loaded'; entries: LeaderboardEntry[] }
  | { kind: 'error' }

export default function LeaderboardScreen() {
  const goHome = useGameStore((s) => s.goHome)
  const tgUser = useTelegramUser()
  const initData = useRawInitData()
  const [mode, setMode] = useState<Mode>('global')
  const [globalState, setGlobalState] = useState<LoadState>({ kind: 'loading' })
  const [friendsState, setFriendsState] = useState<LoadState>({ kind: 'loading' })

  const seed = getTodaySeed()

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

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 flex flex-col px-6 py-8 text-white">
      <header className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={handleGoHome}
          className="text-purple-300 active:scale-95 transition text-sm"
        >
          ← Home
        </button>
        <h1 className="font-semibold">Leaderboard</h1>
        <span className="text-xs text-slate-400 font-mono">{seed}</span>
      </header>

      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-800/60 border border-slate-700 mb-5 text-sm">
        <button
          type="button"
          onClick={() => handleSetMode('global')}
          className={`py-2 rounded-lg transition ${
            mode === 'global'
              ? 'bg-purple-600 text-white'
              : 'text-slate-300 active:scale-95'
          }`}
        >
          Global
        </button>
        <button
          type="button"
          onClick={() => handleSetMode('friends')}
          className={`py-2 rounded-lg transition ${
            mode === 'friends'
              ? 'bg-purple-600 text-white'
              : 'text-slate-300 active:scale-95'
          }`}
        >
          Friends
        </button>
      </div>

      {state.kind === 'loading' && (
        <p className="text-slate-400 text-sm text-center mt-10">Loading…</p>
      )}

      {state.kind === 'error' && (
        <p className="text-rose-400 text-sm text-center mt-10">
          Could not load the leaderboard.
        </p>
      )}

      {state.kind === 'loaded' && state.entries.length === 0 && (
        <FriendsEmptyOrGlobalEmpty mode={mode} onInvite={handleInvite} />
      )}

      {state.kind === 'loaded' && state.entries.length > 0 && (
        <ol className="flex-1 flex flex-col gap-1 overflow-y-auto pb-6">
          {state.entries.map((entry, index) => {
            const isMe = tgUser?.id === entry.telegramId
            const displayName =
              entry.firstName ||
              (entry.username ? `@${entry.username}` : `Player ${entry.telegramId}`)
            return (
              <li
                key={entry.telegramId}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                  isMe ? 'bg-purple-900/60 border border-purple-500' : 'bg-slate-800/40'
                }`}
              >
                <span className="w-6 text-right text-xs text-slate-400 tabular-nums">
                  {index + 1}
                </span>
                {entry.photoUrl ? (
                  <img
                    src={entry.photoUrl}
                    alt=""
                    className="w-8 h-8 rounded-full bg-slate-700 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-700" />
                )}
                <span className="flex-1 truncate text-sm">{displayName}</span>
                <span className="text-sm tabular-nums font-semibold">{entry.score}</span>
              </li>
            )
          })}
        </ol>
      )}
    </main>
  )
}

interface EmptyProps {
  mode: Mode
  onInvite: () => void
}

function FriendsEmptyOrGlobalEmpty({ mode, onInvite }: EmptyProps) {
  if (mode === 'global') {
    return (
      <p className="text-slate-400 text-sm text-center mt-10">
        No scores yet today. Be the first.
      </p>
    )
  }
  return (
    <div className="flex flex-col items-center mt-10 gap-3">
      <p className="text-slate-400 text-sm text-center">
        No friends here yet. Invite someone to play and you'll show up in each
        other's Friends leaderboard.
      </p>
      <button
        type="button"
        onClick={onInvite}
        className="py-2 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold active:scale-95 transition"
      >
        📤 Invite friends
      </button>
    </div>
  )
}
