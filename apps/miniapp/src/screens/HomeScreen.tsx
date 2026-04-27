// Главный экран Mini App. Показывает приветствие с именем юзера из Telegram
// и кнопку Play, которая переводит в игровой экран.

import { useTelegramUser } from '../hooks/useTelegramUser'
import { useGameStore } from '../store/useGameStore'

export default function HomeScreen() {
  const user = useTelegramUser()
  const startGame = useGameStore((s) => s.startGame)
  const greeting = user?.firstName ? `Hello, ${user.firstName}!` : 'Hello!'

  const handlePlay = () => {
    startGame()
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
          onClick={handlePlay}
          className="w-full bg-purple-600 hover:bg-purple-500 active:scale-95 transition py-4 rounded-2xl text-xl font-semibold shadow-lg shadow-purple-900/50"
        >
          Play
        </button>
      </div>
    </main>
  )
}
