// Игровой экран. Сейчас рисует только сегодняшний набор букв и заголовок —
// логика выбора, таймер и подсчёт очков добавятся в следующих шагах.

import { useMemo } from 'react'
import { getDailyLetters, getTodaySeed } from '@word-royale/shared'
import { useGameStore } from '../store/useGameStore'

export default function GameScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  const { seed, letters } = useMemo(() => {
    const today = getTodaySeed()
    return { seed: today, letters: getDailyLetters(today) }
  }, [])

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 flex flex-col px-6 py-8 text-white">
      <header className="flex items-center justify-between mb-10">
        <button
          type="button"
          onClick={() => setScreen('home')}
          className="text-purple-300 active:scale-95 transition text-sm"
        >
          ← Back
        </button>
        <span className="text-xs text-slate-400 font-mono">{seed}</span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-purple-300 mb-2 text-sm uppercase tracking-widest">Today's letters</p>
        <h1 className="text-2xl font-semibold mb-12 text-slate-200">
          Make as many words as you can
        </h1>

        <div className="grid grid-cols-4 gap-3 max-w-sm w-full">
          {letters.map((letter, i) => (
            <LetterTile key={i} letter={letter} />
          ))}
        </div>

        <p className="text-slate-500 text-sm mt-12 text-center">
          Selection and timer wired in next step.
        </p>
      </div>
    </main>
  )
}

function LetterTile({ letter }: { letter: string }) {
  return (
    <div className="aspect-square flex items-center justify-center bg-slate-800/70 border border-purple-500/30 rounded-2xl text-3xl font-bold uppercase shadow-lg shadow-purple-900/30">
      {letter}
    </div>
  )
}
