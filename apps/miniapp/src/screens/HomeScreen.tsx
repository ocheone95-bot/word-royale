// Главный экран Mini App. Показывает приветствие с именем юзера из Telegram,
// кнопки Play, Leaderboard и Invite friends (откроет нативный Telegram-share
// со ссылкой `t.me/word_royale_bot/play?startapp=ref_<userId>`).

import { useTelegramUser } from '../hooks/useTelegramUser'
import { useGameStore } from '../store/useGameStore'
import {
  buildInviteText,
  buildPlayDeepLink,
  buildTelegramShareLink,
} from '../lib/share'
import { openTelegramLink } from '../lib/telegram'

export default function HomeScreen() {
  const user = useTelegramUser()
  const startGame = useGameStore((s) => s.startGame)
  const showLeaderboard = useGameStore((s) => s.showLeaderboard)
  const greeting = user?.firstName ? `Hello, ${user.firstName}!` : 'Hello!'

  const handleInvite = () => {
    const url = buildPlayDeepLink(user?.id ?? null)
    openTelegramLink(buildTelegramShareLink(buildInviteText(), url))
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 flex flex-col items-center justify-center px-6 text-white">
      <div className="max-w-md w-full text-center">
        <p className="text-purple-300 mb-2 text-base">{greeting}</p>
        <h1 className="text-5xl font-bold tracking-tight mb-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Word Royale
        </h1>
        <p className="text-slate-300 mb-12 text-lg">
          Daily 90-second word puzzle. Same letters for everyone.
        </p>
        <button
          type="button"
          onClick={startGame}
          className="w-full bg-purple-600 hover:bg-purple-500 active:scale-95 transition py-4 rounded-2xl text-xl font-semibold shadow-lg shadow-purple-900/50 mb-3"
        >
          Play
        </button>
        <button
          type="button"
          onClick={showLeaderboard}
          className="w-full border border-slate-600 text-slate-200 active:scale-95 transition py-3 rounded-2xl text-base mb-3"
        >
          Leaderboard
        </button>
        <button
          type="button"
          onClick={handleInvite}
          className="w-full text-purple-300 active:scale-95 transition py-2 rounded-2xl text-sm"
        >
          📤 Invite friends
        </button>
      </div>
    </main>
  )
}
