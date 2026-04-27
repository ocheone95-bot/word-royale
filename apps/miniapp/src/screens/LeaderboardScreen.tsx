// Глобальный лидерборд за сегодняшний UTC-день. Топ-100, лучший скор
// каждого юзера. Текущий игрок (если играл) подсвечен.

import { useEffect, useState } from 'react'
import { getTodaySeed } from '@word-royale/shared'
import { fetchDailyLeaderboard, type LeaderboardEntry } from '../lib/api'
import { useGameStore } from '../store/useGameStore'
import { useTelegramUser } from '../hooks/useTelegramUser'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'loaded'; entries: LeaderboardEntry[] }
  | { kind: 'error' }

export default function LeaderboardScreen() {
  const goHome = useGameStore((s) => s.goHome)
  const tgUser = useTelegramUser()
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  const seed = getTodaySeed()

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    fetchDailyLeaderboard(seed)
      .then((entries) => {
        if (!cancelled) setState({ kind: 'loaded', entries })
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [seed])

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 flex flex-col px-6 py-8 text-white">
      <header className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={goHome}
          className="text-purple-300 active:scale-95 transition text-sm"
        >
          ← Home
        </button>
        <h1 className="font-semibold">Today's Top 100</h1>
        <span className="text-xs text-slate-400 font-mono">{seed}</span>
      </header>

      {state.kind === 'loading' && (
        <p className="text-slate-400 text-sm text-center mt-10">Loading…</p>
      )}

      {state.kind === 'error' && (
        <p className="text-rose-400 text-sm text-center mt-10">
          Could not load the leaderboard.
        </p>
      )}

      {state.kind === 'loaded' && state.entries.length === 0 && (
        <p className="text-slate-400 text-sm text-center mt-10">
          No scores yet today. Be the first.
        </p>
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
