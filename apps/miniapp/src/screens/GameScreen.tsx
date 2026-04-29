// Игровой экран. Saloon-redesign: StatPanel'ы для score/time с warning,
// Now Spelling display с brass border + glow, Mostaccio реагирует на
// каждый submit, круглые LetterTile с amber glow при выборе.
//
// Game logic — без изменений (store driven). Меняем только presentation.

import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateScore } from '@word-royale/shared'
import { useGameStore, type Feedback } from '../store/useGameStore'
import { useDictionary } from '../hooks/useDictionary'
import { hapticImpact } from '../lib/haptics'
import { Mostaccio, type MostaccioPose } from '../components/Mostaccio'
import { Card, LetterTile, SaloonButton, Scanlines, StatPanel } from '../components/saloon'
import { t, useLang } from '../lib/i18n'

function formatTimer(timeLeft: number): string {
  const m = Math.floor(timeLeft / 60)
  const s = timeLeft % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function feedbackEyebrow(feedback: Feedback): { text: string; isError: boolean } {
  if (feedback === 'invalid')
    return { text: t('game.feedback_invalid'), isError: true }
  if (feedback === 'duplicate')
    return { text: t('game.feedback_duplicate'), isError: true }
  if (feedback === 'too-short')
    return { text: t('game.feedback_too_short'), isError: true }
  return { text: t('game.now_spelling'), isError: false }
}

export default function GameScreen() {
  useLang()
  const { dict, error } = useDictionary()
  const seed = useGameStore((s) => s.seed)
  const letters = useGameStore((s) => s.letters)
  const selectedIndices = useGameStore((s) => s.selectedIndices)
  const foundWords = useGameStore((s) => s.foundWords)
  const score = useGameStore((s) => s.score)
  const feedback = useGameStore((s) => s.feedback)
  const timeLeft = useGameStore((s) => s.timeLeft)
  const todayStatus = useGameStore((s) => s.todayStatus)
  const doubleScoreActive =
    todayStatus.loaded && todayStatus.doubleScoreActive
  const goHome = useGameStore((s) => s.goHome)
  const toggleLetter = useGameStore((s) => s.toggleLetter)
  const clearSelection = useGameStore((s) => s.clearSelection)
  const clearFeedback = useGameStore((s) => s.clearFeedback)
  const submitWord = useGameStore((s) => s.submitWord)
  const tickTimer = useGameStore((s) => s.tickTimer)

  // Поза кота. Управляется локально, чтобы успеть «прыгнуть» на success
  // и вернуться в idle через 800ms (feedback из store очищается за 700ms).
  const [pose, setPose] = useState<MostaccioPose>('idle')
  const lastFeedbackRef = useRef<Feedback>(null)

  useEffect(() => {
    if (!feedback) return
    lastFeedbackRef.current = feedback
    if (feedback === 'success') {
      const last = foundWords[foundWords.length - 1] ?? ''
      setPose(last.length >= 5 ? 'bigjump' : 'jump')
    } else {
      setPose('hmpf')
    }
    const t = setTimeout(() => {
      setPose(selectedIndices.length > 0 ? 'tilt' : 'idle')
      clearFeedback()
    }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback])

  useEffect(() => {
    // Когда feedback нет — поза определяется наличием выделения.
    if (lastFeedbackRef.current) return
    setPose(selectedIndices.length > 0 ? 'tilt' : 'idle')
  }, [selectedIndices.length])

  useEffect(() => {
    const id = setInterval(tickTimer, 1000)
    return () => clearInterval(id)
  }, [tickTimer])

  const currentWord = useMemo(
    () => selectedIndices.map((i) => letters[i] ?? '').join(''),
    [selectedIndices, letters],
  )
  const previewScore = calculateScore(currentWord)
  const eyebrow = feedbackEyebrow(feedback)

  const handleGoHome = () => {
    hapticImpact('light')
    goHome()
  }
  const handleClear = () => {
    hapticImpact('light')
    clearSelection()
  }
  const handleUndo = () => {
    hapticImpact('light')
    if (selectedIndices.length === 0) return
    const last = selectedIndices[selectedIndices.length - 1]
    toggleLetter(last) // тап по последней удаляет её
  }
  const handleSubmit = () => {
    if (!dict || selectedIndices.length === 0) return
    submitWord(dict)
  }

  const wordSize =
    currentWord.length >= 7 ? 36 : currentWord.length >= 5 ? 42 : 48

  // Top row 4 tiles, bottom row 3 (по handoff offset вправо) — для узкого
  // viewport оставляем простую центровку, более красивый offset — Phase D.
  const topLetters = letters.slice(0, 4)
  const bottomLetters = letters.slice(4, 7)

  return (
    <main
      style={{
        minHeight: '100vh',
        position: 'relative',
        background:
          'radial-gradient(ellipse at 50% 30%, var(--tint-page) 0%, transparent 55%), radial-gradient(circle at 50% 110%, rgba(0,0,0,0.7) 0%, transparent 65%), var(--bg-grain)',
        color: 'var(--text-parchment)',
        paddingInline: 14,
        paddingTop: 12,
        paddingBottom: 24,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Scanlines enabled opacity={0.1} />

      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <StatPanel label={t('game.score')} value={String(score)} />
        <button
          type="button"
          onClick={handleGoHome}
          aria-label="Close"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-parchment-dim)',
            fontFamily: 'var(--font-pixel)',
            fontSize: 22,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            padding: 6,
          }}
        >
          ×
        </button>
        <StatPanel
          label={t('game.time')}
          value={formatTimer(timeLeft)}
          warning={timeLeft <= 10 && timeLeft > 0}
        />
      </header>

      {doubleScoreActive && (
        <p
          style={{
            textAlign: 'center',
            marginTop: 6,
            fontSize: 10,
            fontFamily: 'var(--font-pixel)',
            color: 'var(--accent-brass-hi)',
            letterSpacing: 2,
            textTransform: 'uppercase',
            textShadow: '0 0 8px rgba(212,168,73,0.5)',
          }}
        >
          {t('game.boost_x2')}
        </p>
      )}

      {error ? (
        <DictionaryError error={error} />
      ) : !dict ? (
        <LoadingDictionary />
      ) : (
        <>
          <Card surface="table" padding="14px 16px 18px" style={{ marginTop: 12 }}>
            <p
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 9,
                color: eyebrow.isError ? 'var(--ember-warn-hi)' : 'var(--accent-brass)',
                letterSpacing: 1.8,
                textTransform: 'uppercase',
                margin: 0,
                lineHeight: 1,
              }}
            >
              {eyebrow.text}
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: wordSize,
                fontWeight: 700,
                margin: '8px 0 0',
                lineHeight: 1,
                textTransform: 'uppercase',
                letterSpacing: 6,
                color: eyebrow.isError ? '#ff5a3d' : 'var(--glow-pixel)',
                textShadow: eyebrow.isError
                  ? '0 0 8px #ff5a3d'
                  : '0 0 8px var(--glow-pixel), 0 0 18px var(--accent-lamp)',
                minHeight: 48,
              }}
            >
              {currentWord || ' '}
            </h2>
            {currentWord.length >= 3 && !eyebrow.isError && (
              <p
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: 'var(--text-parchment-dim)',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {currentWord.length} letters · +{previewScore}
              </p>
            )}
          </Card>

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: 16,
              minHeight: 28 * 2.8 + 20,
            }}
          >
            <Mostaccio pose={pose} scale={2.8} />
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              {topLetters.map((l, i) => (
                <LetterTileForRack
                  key={i}
                  letter={l}
                  index={i}
                  selected={selectedIndices.indexOf(i) !== -1}
                  order={selectedIndices.indexOf(i)}
                  onClick={toggleLetter}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {bottomLetters.map((l, i) => (
                <LetterTileForRack
                  key={i + 4}
                  letter={l}
                  index={i + 4}
                  selected={selectedIndices.indexOf(i + 4) !== -1}
                  order={selectedIndices.indexOf(i + 4)}
                  onClick={toggleLetter}
                />
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 18,
              paddingInline: 4,
            }}
          >
            <SaloonButton
              variant="secondary"
              size="md"
              onClick={handleUndo}
              disabled={selectedIndices.length === 0}
              style={{ flex: 1 }}
            >
              ↶ {t('game.undo')}
            </SaloonButton>
            <SaloonButton
              variant="primary"
              size="md"
              onClick={handleSubmit}
              disabled={selectedIndices.length < 3}
              style={{ flex: 1.4 }}
            >
              ↵ {t('game.submit')}
            </SaloonButton>
            <SaloonButton
              variant="secondary"
              size="md"
              onClick={handleClear}
              disabled={selectedIndices.length === 0}
              style={{ flex: 1 }}
            >
              ⟲ {t('game.clear')}
            </SaloonButton>
          </div>

          <FoundWordsCard words={foundWords} seed={seed} />
        </>
      )}
    </main>
  )
}

function LetterTileForRack({
  letter,
  index,
  selected,
  order,
  onClick,
}: {
  letter: string
  index: number
  selected: boolean
  order: number
  onClick: (i: number) => void
}) {
  return (
    <LetterTile
      letter={letter}
      size={50}
      selected={selected}
      order={selected ? order : null}
      onClick={() => onClick(index)}
    />
  )
}

function FoundWordsCard({ words, seed }: { words: readonly string[]; seed: string }) {
  if (words.length === 0) {
    return (
      <p
        style={{
          marginTop: 24,
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--text-ash)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {seed}
      </p>
    )
  }
  return (
    <Card surface="table" padding={12} style={{ marginTop: 18 }}>
      <p
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 9,
          color: 'var(--accent-brass)',
          letterSpacing: 1.8,
          textTransform: 'uppercase',
          margin: '0 0 6px',
        }}
      >
        {t('result.words_found')} · {words.length}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {words.map((w) => (
          <span
            key={w}
            style={{
              padding: '3px 8px',
              borderRadius: 999,
              background: 'rgba(58,40,24,0.7)',
              border: '1px solid rgba(212,168,73,0.3)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 700,
              fontSize: 11,
              color: 'var(--text-parchment)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {w}{' '}
            <span
              style={{
                color: 'var(--accent-brass)',
                fontFamily: 'var(--font-pixel)',
                fontSize: 10,
                marginLeft: 2,
              }}
            >
              +{calculateScore(w)}
            </span>
          </span>
        ))}
      </div>
    </Card>
  )
}

function LoadingDictionary() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-parchment-dim)',
        fontSize: 13,
      }}
    >
      {t('common.loading')}
    </div>
  )
}

function DictionaryError({ error }: { error: Error }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <p style={{ color: '#ff5a3d', fontWeight: 700 }}>Failed to load dictionary</p>
      <p
        style={{
          fontSize: 12,
          color: 'var(--text-parchment-dim)',
          fontFamily: 'monospace',
          marginTop: 8,
        }}
      >
        {error.message}
      </p>
    </div>
  )
}
