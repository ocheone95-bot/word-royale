// 3-слайдовый онбординг для новичков. Показывается один раз — флаг
// в localStorage. Skip и финальный Get Started ведут в одно и то же
// место (HomeScreen), но трекаются как разные события.

import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { hapticImpact } from '../lib/haptics'

interface OnboardingScreenProps {
  onComplete: (reason: 'completed' | 'skipped') => void
}

interface Slide {
  title: string
  description: string
  visual: () => React.ReactElement
}

const SLIDES: readonly Slide[] = [
  {
    title: 'Make words from 7 letters',
    description:
      'Tap letters to build words. Longer words score more. You have 90 seconds.',
    visual: () => <LettersVisual letters={['W', 'O', 'R', 'D']} />,
  },
  {
    title: 'Same letters for everyone',
    description:
      'Every player in the world gets the same 7 letters today. Come back tomorrow for a new set.',
    visual: () => <DailyVisual />,
  },
  {
    title: 'Share & invite friends',
    description:
      'Show off your score with a Wordle-style share. Invite friends to compete on a private leaderboard.',
    visual: () => <ShareVisual />,
  },
] as const

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    track('onboarding_started')
  }, [])

  useEffect(() => {
    track('onboarding_step_viewed', { step })
  }, [step])

  const isLast = step === SLIDES.length - 1
  const slide = SLIDES[step]

  const handleNext = () => {
    if (isLast) {
      hapticImpact('medium')
      track('onboarding_completed')
      onComplete('completed')
    } else {
      hapticImpact('light')
      setStep((s) => s + 1)
    }
  }

  const handleSkip = () => {
    hapticImpact('light')
    track('onboarding_skipped', { step })
    onComplete('skipped')
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 flex flex-col px-6 py-8 text-white">
      <div className="flex justify-end">
        {!isLast && (
          <button
            type="button"
            onClick={handleSkip}
            className="text-slate-400 active:scale-95 transition text-sm"
          >
            Skip
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
        <div className="mb-8 h-32 flex items-center justify-center">
          {slide.visual()}
        </div>
        <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          {slide.title}
        </h2>
        <p className="text-slate-300 text-base">{slide.description}</p>
      </div>

      <div className="flex flex-col items-center gap-6 mb-2">
        <div className="flex gap-2" aria-label="Onboarding progress">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step
                  ? 'w-8 bg-purple-400'
                  : 'w-2 bg-slate-700'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={handleNext}
          className="w-full max-w-sm bg-purple-600 hover:bg-purple-500 active:scale-95 transition py-4 rounded-2xl text-lg font-semibold shadow-lg shadow-purple-900/50"
        >
          {isLast ? 'Get started' : 'Next'}
        </button>
      </div>
    </main>
  )
}

function LettersVisual({ letters }: { letters: readonly string[] }) {
  return (
    <div className="flex gap-2">
      {letters.map((letter, i) => (
        <div
          key={i}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold border-2"
          style={{
            background: 'var(--tile-bg-selected)',
            borderColor: 'var(--tile-border-selected)',
            color: 'var(--tile-text-selected)',
            boxShadow: '0 8px 12px -4px var(--tile-shadow-selected)',
          }}
        >
          {letter}
        </div>
      ))}
    </div>
  )
}

function DailyVisual() {
  return (
    <div className="text-6xl">🗓️</div>
  )
}

function ShareVisual() {
  return (
    <div className="text-6xl">📤</div>
  )
}
