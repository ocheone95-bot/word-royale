// 3-слайдовый онбординг с Mostaccio как guide. Saloon-палитра, pixel
// логотип на 1-м экране, кот ведёт через шаги (wink → point → crown).
// Skip / Next / Get started кнопки. Логика track + onComplete сохранена.

import { useEffect, useState } from 'react'
import { track } from '../lib/analytics'
import { hapticImpact } from '../lib/haptics'
import { Mostaccio, type MostaccioPose } from '../components/Mostaccio'
import { PixelLogo } from '../components/PixelLogo'
import { SaloonButton } from '../components/saloon'
import { t, useLang } from '../lib/i18n'

interface OnboardingScreenProps {
  onComplete: (reason: 'completed' | 'skipped') => void
}

interface Slide {
  pose: MostaccioPose
  titleKey: 'onb.slide1_title' | 'onb.slide2_title' | 'onb.slide3_title'
  bodyKey: 'onb.slide1_body' | 'onb.slide2_body' | 'onb.slide3_body'
}

const SLIDES: readonly Slide[] = [
  { pose: 'smile', titleKey: 'onb.slide1_title', bodyKey: 'onb.slide1_body' },
  { pose: 'point', titleKey: 'onb.slide2_title', bodyKey: 'onb.slide2_body' },
  { pose: 'pro', titleKey: 'onb.slide3_title', bodyKey: 'onb.slide3_body' },
] as const

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  useLang()
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
    <main
      style={{
        minHeight: '100vh',
        position: 'relative',
        background:
          'radial-gradient(circle at 50% 0%, var(--tint-page) 0%, transparent 50%), var(--bg-room)',
        color: 'var(--text-parchment)',
        paddingInline: 24,
        paddingTop: 16,
        paddingBottom: 28,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          minHeight: 24,
        }}
      >
        {!isLast && (
          <button
            type="button"
            onClick={handleSkip}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-ash)',
              fontFamily: 'var(--font-ui)',
              fontSize: 13,
              padding: '4px 8px',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {t('onb.skip')}
          </button>
        )}
      </div>

      {step === 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: 4,
            gap: 4,
          }}
        >
          <PixelLogo text="WORD" scale={4} color="#ff8c42" glow="#ff8c42" />
          <PixelLogo
            text="ROYALE"
            scale={4}
            color="#f4e4bc"
            glow="#ff8c42"
            glowStrength="md"
          />
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          maxWidth: 320,
          margin: '0 auto',
          gap: 22,
          paddingBlock: 24,
        }}
      >
        <Mostaccio pose={slide.pose} scale={3.5} />
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            fontWeight: 400,
            color: 'var(--text-parchment)',
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          {t(slide.titleKey)}
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 15,
            color: 'var(--text-parchment-dim)',
            margin: 0,
            lineHeight: 1.45,
          }}
        >
          {t(slide.bodyKey)}
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }} aria-label="Onboarding progress">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              style={{
                height: 6,
                width: i === step ? 28 : 6,
                borderRadius: 999,
                background:
                  i === step ? 'var(--accent-lamp)' : 'var(--bg-leather)',
                boxShadow:
                  i === step ? '0 0 8px rgba(255,140,66,0.6)' : 'none',
                transition: 'width 200ms ease-out',
              }}
            />
          ))}
        </div>
        <SaloonButton
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleNext}
        >
          {isLast ? t('onb.start') : t('onb.next')}
        </SaloonButton>
      </div>
    </main>
  )
}
