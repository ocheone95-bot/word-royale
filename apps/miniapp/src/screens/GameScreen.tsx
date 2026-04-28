// Игровой экран. Тап по тайлам собирает слово, Submit проверяет его в словаре,
// валидное слово даёт очки и попадает в список найденных. Таймер появится дальше.

import { useEffect } from 'react'
import { calculateScore } from '@word-royale/shared'
import { useGameStore, type Feedback } from '../store/useGameStore'
import { useDictionary } from '../hooks/useDictionary'

export default function GameScreen() {
  const { dict, error } = useDictionary()
  const seed = useGameStore((s) => s.seed)
  const letters = useGameStore((s) => s.letters)
  const selectedIndices = useGameStore((s) => s.selectedIndices)
  const foundWords = useGameStore((s) => s.foundWords)
  const score = useGameStore((s) => s.score)
  const feedback = useGameStore((s) => s.feedback)
  const timeLeft = useGameStore((s) => s.timeLeft)
  const goHome = useGameStore((s) => s.goHome)
  const toggleLetter = useGameStore((s) => s.toggleLetter)
  const clearSelection = useGameStore((s) => s.clearSelection)
  const clearFeedback = useGameStore((s) => s.clearFeedback)
  const submitWord = useGameStore((s) => s.submitWord)
  const tickTimer = useGameStore((s) => s.tickTimer)

  // Сбрасываем feedback через 700ms — короткой подсветки достаточно
  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(clearFeedback, 700)
    return () => clearTimeout(t)
  }, [feedback, clearFeedback])

  // Тик таймера раз в секунду; tickTimer сам остановится на 0 и переведёт на result
  useEffect(() => {
    const id = setInterval(tickTimer, 1000)
    return () => clearInterval(id)
  }, [tickTimer])

  const currentWord = selectedIndices.map((i) => letters[i] ?? '').join('')
  const previewScore = calculateScore(currentWord)

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 flex flex-col px-6 py-6 text-white">
      <header className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={goHome}
          className="text-purple-300 active:scale-95 transition text-sm"
        >
          ← Back
        </button>
        <Timer timeLeft={timeLeft} seed={seed} />
        <span className="text-base font-bold tabular-nums">{score}</span>
      </header>

      {error ? (
        <DictionaryError error={error} />
      ) : !dict ? (
        <LoadingDictionary />
      ) : (
        <div className="flex-1 flex flex-col items-center">
          <CurrentWord word={currentWord} previewScore={previewScore} feedback={feedback} />

          <div className="grid grid-cols-4 gap-3 max-w-sm w-full mb-6 mt-6">
            {letters.map((letter, i) => {
              const order = selectedIndices.indexOf(i)
              return (
                <LetterTile
                  key={i}
                  letter={letter}
                  order={order}
                  onClick={() => toggleLetter(i)}
                />
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-sm w-full">
            <button
              type="button"
              onClick={clearSelection}
              disabled={selectedIndices.length === 0}
              className="py-3 rounded-xl border border-slate-600 text-slate-300 active:scale-95 transition disabled:opacity-40 disabled:active:scale-100"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => submitWord(dict)}
              disabled={selectedIndices.length === 0}
              className="py-3 rounded-xl bg-purple-600 text-white font-semibold active:scale-95 transition disabled:opacity-40 disabled:active:scale-100"
            >
              Submit
            </button>
          </div>

          <FoundWords words={foundWords} />
        </div>
      )}
    </main>
  )
}

function Timer({ timeLeft, seed }: { timeLeft: number; seed: string }) {
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const formatted = `${minutes}:${String(seconds).padStart(2, '0')}`
  const danger = timeLeft <= 10
  return (
    <div className="flex flex-col items-center">
      <span
        className={`text-xl font-bold tabular-nums transition-colors ${
          danger ? 'text-red-400 animate-pulse' : 'text-slate-100'
        }`}
      >
        {formatted}
      </span>
      <span className="text-[10px] text-slate-500 font-mono">{seed}</span>
    </div>
  )
}

function CurrentWord({
  word,
  previewScore,
  feedback,
}: {
  word: string
  previewScore: number
  feedback: Feedback
}) {
  const placeholder = !word
  const colorClass =
    feedback === 'success'
      ? 'text-green-400'
      : feedback === 'invalid' || feedback === 'too-short'
      ? 'text-red-400'
      : feedback === 'duplicate'
      ? 'text-amber-400'
      : 'text-white'

  const message =
    feedback === 'success'
      ? '✓ Nice!'
      : feedback === 'invalid'
      ? 'Not in dictionary'
      : feedback === 'too-short'
      ? 'At least 3 letters'
      : feedback === 'duplicate'
      ? 'Already found'
      : previewScore > 0
      ? `+${previewScore}`
      : ' '

  return (
    <div className="text-center min-h-[88px]">
      <h2
        className={`text-4xl font-bold uppercase tracking-widest transition-colors ${colorClass}`}
      >
        {placeholder ? <span className="text-slate-600">tap letters</span> : word}
      </h2>
      <p className={`mt-2 text-sm font-medium transition-colors ${colorClass}`}>{message}</p>
    </div>
  )
}

function LetterTile({
  letter,
  order,
  onClick,
}: {
  letter: string
  order: number
  onClick: () => void
}) {
  const selected = order !== -1
  // Цвета и тени берутся из CSS-переменных, заданных активной темой в index.css.
  // Поэтому смена темы перекрашивает тайлы без переключения React-кода.
  const style: React.CSSProperties = selected
    ? {
        background: 'var(--tile-bg-selected)',
        borderColor: 'var(--tile-border-selected)',
        boxShadow: '0 10px 15px -3px var(--tile-shadow-selected)',
        color: 'var(--tile-text-selected)',
      }
    : {
        background: 'var(--tile-bg)',
        borderColor: 'var(--tile-border)',
        boxShadow: '0 10px 15px -3px var(--tile-shadow)',
        color: 'var(--tile-text)',
      }
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`relative aspect-square flex items-center justify-center rounded-2xl text-3xl font-bold uppercase transition active:scale-95 ${
        selected ? 'border-2' : 'border'
      }`}
    >
      {letter}
      {selected && (
        <span
          className="absolute top-1 right-1 text-[10px] font-mono"
          style={{ color: 'var(--tile-order)' }}
        >
          {order + 1}
        </span>
      )}
    </button>
  )
}

function FoundWords({ words }: { words: readonly string[] }) {
  if (words.length === 0) {
    return (
      <p className="text-slate-500 text-sm mt-8 text-center">
        Find your first word to see it here.
      </p>
    )
  }
  return (
    <div className="mt-8 w-full max-w-sm">
      <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">
        Found {words.length}
      </p>
      <div className="flex flex-wrap gap-2">
        {words.map((w) => (
          <span
            key={w}
            className="px-2 py-1 rounded-md bg-slate-800/70 border border-slate-700 text-sm uppercase font-mono"
          >
            {w}
          </span>
        ))}
      </div>
    </div>
  )
}

function LoadingDictionary() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-slate-400 text-sm">Loading dictionary…</p>
    </div>
  )
}

function DictionaryError({ error }: { error: Error }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 text-center">
      <div>
        <p className="text-red-400 text-base font-semibold mb-2">Failed to load dictionary</p>
        <p className="text-slate-400 text-xs font-mono">{error.message}</p>
      </div>
    </div>
  )
}
