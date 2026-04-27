// Экран итогов партии. Показывает финальный счёт, найденные слова и кнопки
// Play again / Home. Rate-limit (1 игра в день в free tier) подключим на
// Неделе 4 вместе со Stars-логикой повторов.

import { useGameStore } from '../store/useGameStore'

export default function ResultScreen() {
  const score = useGameStore((s) => s.score)
  const foundWords = useGameStore((s) => s.foundWords)
  const seed = useGameStore((s) => s.seed)
  const startGame = useGameStore((s) => s.startGame)
  const goHome = useGameStore((s) => s.goHome)

  const longest = foundWords.reduce((a, b) => (b.length > a.length ? b : a), '')

  // Сортируем по длине убывающе для красивого вывода
  const sorted = [...foundWords].sort((a, b) => b.length - a.length || a.localeCompare(b))

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 flex flex-col px-6 py-8 text-white">
      <header className="flex items-center justify-between mb-8">
        <button
          type="button"
          onClick={goHome}
          className="text-purple-300 active:scale-95 transition text-sm"
        >
          ← Home
        </button>
        <span className="text-xs text-slate-400 font-mono">{seed}</span>
        <span className="w-12" />
      </header>

      <div className="flex-1 flex flex-col items-center">
        <p className="text-purple-300 mb-2 text-sm uppercase tracking-widest">Time's up</p>
        <h1 className="text-7xl font-bold tracking-tight mb-1 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent tabular-nums">
          {score}
        </h1>
        <p className="text-slate-400 text-sm mb-10">
          {foundWords.length} word{foundWords.length === 1 ? '' : 's'}
          {longest ? ` · longest: ${longest.toUpperCase()}` : ''}
        </p>

        {sorted.length > 0 ? (
          <div className="w-full max-w-sm mb-10">
            <div className="flex flex-wrap gap-2 justify-center">
              {sorted.map((w) => (
                <span
                  key={w}
                  className="px-2 py-1 rounded-md bg-slate-800/70 border border-slate-700 text-sm uppercase font-mono"
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-slate-500 mb-10">No words this round.</p>
        )}

        <div className="grid grid-cols-2 gap-3 max-w-sm w-full mt-auto">
          <button
            type="button"
            onClick={goHome}
            className="py-3 rounded-xl border border-slate-600 text-slate-300 active:scale-95 transition"
          >
            Home
          </button>
          <button
            type="button"
            onClick={startGame}
            className="py-3 rounded-xl bg-purple-600 text-white font-semibold active:scale-95 transition"
          >
            Play again
          </button>
        </div>
      </div>
    </main>
  )
}
