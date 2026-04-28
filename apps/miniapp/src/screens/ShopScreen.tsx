// Shop-экран. Saloon-redesign Phase D: Mostaccio в роли торговца указывает
// на витрину, секции (Replay/Themes/Boosts/Subscription) — Card, кнопки —
// SaloonButton, превью тем — мини-тайлы в палитрах будущих тем (Phase D/2
// переключит весь UI через [data-theme="..."] override на design-tokens).
//
// Логика покупок не менялась: deep-link в бот → Stars-инвойс → webhook → RPC,
// today-status подтягивается на маунте и при visibilitychange после возврата.

import { useEffect } from 'react'
import { useRawInitData } from '@telegram-apps/sdk-react'
import { useGameStore, type ThemeId } from '../store/useGameStore'
import {
  buildBuyDeepLink,
  buildBuyReplayDeepLink,
  buildBuyThemeDeepLink,
} from '../lib/share'
import { openTelegramLink } from '../lib/telegram'
import { track } from '../lib/analytics'
import { hapticImpact } from '../lib/haptics'
import { Mostaccio } from '../components/Mostaccio'
import {
  Card,
  ProBadge,
  SaloonButton,
  TabBar,
  type TabKey,
} from '../components/saloon'

const REPLAY_PRICE_STARS = 50
const THEME_PRICE_STARS = 100
const DOUBLE_SCORE_PRICE_STARS = 200
const PRO_PRICE_STARS = 150

interface ThemeCatalogEntry {
  id: ThemeId
  title: string
  // Внутреннее имя «комнаты» из handoff'а — дублируется в design-tokens
  // оверрайдах на Шаге 2. Названия в UI оставляем дружелюбные (Classic/Neon/…)
  // чтобы не ломать ассоциацию с product_id, под которые юзеры покупали.
  flavour: string
  description: string
  preview: ThemePalette
}

interface ThemePalette {
  bgInner: string
  bgOuter: string
  border: string
  text: string
  glow: string
}

// Палитры из handoff'а phase5.jsx THEME_PRESETS + Neo-Tokyo (5-я тема).
// Эти же значения на Шаге 2 переедут в design-tokens.css как [data-theme]
// блоки. Неважно, что часть «комнаты» (bg-room, brass и т.п.) тут не видна —
// хватает основных трёх: фон тайла, граница, glow.
const THEME_CATALOG: readonly ThemeCatalogEntry[] = [
  {
    id: 'default',
    title: 'Classic',
    flavour: 'The Saloon · default',
    description: 'Warm amber lamps and brass accents.',
    preview: {
      bgInner: '#3a2818',
      bgOuter: '#0a0604',
      border: '#d4a849',
      text: '#f4e4bc',
      glow: '#ffb84d',
    },
  },
  {
    id: 'neon',
    title: 'Neon',
    flavour: 'The Arcade',
    description: 'Cyan glow on midnight blue.',
    preview: {
      bgInner: '#15182c',
      bgOuter: '#04031a',
      border: '#42d4ff',
      text: '#9adfff',
      glow: '#42d4ff',
    },
  },
  {
    id: 'retro',
    title: 'Retro',
    flavour: 'The Diner ’74',
    description: 'Mustard sign over sienna walls.',
    preview: {
      bgInner: '#5a2010',
      bgOuter: '#1a0c04',
      border: '#f4c542',
      text: '#f4e4bc',
      glow: '#c4541f',
    },
  },
  {
    id: 'sakura',
    title: 'Sakura',
    flavour: 'Kyoto',
    description: 'Cherry-blossom pink on dark wood.',
    preview: {
      bgInner: '#5a2840',
      bgOuter: '#0a0508',
      border: '#ffb8d4',
      text: '#f4e4bc',
      glow: '#c44878',
    },
  },
  {
    id: 'cyberpunk',
    title: 'Cyberpunk',
    flavour: 'Neo-Tokyo',
    description: 'Magenta + electric yellow on void.',
    preview: {
      bgInner: '#0a0010',
      bgOuter: '#000000',
      border: '#ff00ff',
      text: '#ffff00',
      glow: '#ff00ff',
    },
  },
] as const

export default function ShopScreen() {
  const initData = useRawInitData()
  const goHome = useGameStore((s) => s.goHome)
  const showLeaderboard = useGameStore((s) => s.showLeaderboard)
  const showMe = useGameStore((s) => s.showMe)
  const todayStatus = useGameStore((s) => s.todayStatus)
  const refreshTodayStatus = useGameStore((s) => s.refreshTodayStatus)
  const selectedTheme = useGameStore((s) => s.selectedTheme)
  const setSelectedTheme = useGameStore((s) => s.setSelectedTheme)

  useEffect(() => {
    track('shop_opened')
  }, [])

  useEffect(() => {
    if (!initData) return
    void refreshTodayStatus(initData)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshTodayStatus(initData)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [initData, refreshTodayStatus])

  const replayCredits = todayStatus.loaded ? todayStatus.replayCredits : 0
  const ownedThemes = todayStatus.loaded ? todayStatus.themes : []
  const doubleScoreActive = todayStatus.loaded && todayStatus.doubleScoreActive
  const proActive = todayStatus.loaded && todayStatus.proActive
  const proExpiresAt = todayStatus.loaded ? todayStatus.proExpiresAt : null

  const handleBuyReplay = () => {
    hapticImpact('medium')
    track('iap_initiated', {
      product_id: 'replay',
      price_stars: REPLAY_PRICE_STARS,
      source: 'shop',
    })
    openTelegramLink(buildBuyReplayDeepLink())
  }
  const handleBuyTheme = (id: ThemeId) => {
    hapticImpact('medium')
    track('iap_initiated', {
      product_id: `theme_${id}`,
      price_stars: THEME_PRICE_STARS,
      source: 'shop',
    })
    openTelegramLink(buildBuyThemeDeepLink(id))
  }
  const handleBuyDoubleScore = () => {
    hapticImpact('medium')
    track('iap_initiated', {
      product_id: 'double_score',
      price_stars: DOUBLE_SCORE_PRICE_STARS,
      source: 'shop',
    })
    openTelegramLink(buildBuyDeepLink('double_score'))
  }
  const handleBuyPro = () => {
    hapticImpact('medium')
    track('iap_initiated', {
      product_id: 'pro_subscription',
      price_stars: PRO_PRICE_STARS,
      source: 'shop',
    })
    openTelegramLink(buildBuyDeepLink('pro_subscription'))
  }
  const handleApplyTheme = (id: ThemeId) => {
    hapticImpact('light')
    setSelectedTheme(id)
  }
  const handleGoHome = () => {
    hapticImpact('light')
    goHome()
  }
  const handleTabChange = (key: TabKey) => {
    if (key === 'shop') return
    hapticImpact('light')
    if (key === 'home') goHome()
    else if (key === 'board') showLeaderboard()
    else if (key === 'me') showMe()
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        position: 'relative',
        background: 'var(--gradient-page)',
        color: 'var(--text-parchment)',
        paddingInline: 18,
        paddingTop: 14,
        paddingBottom: 100,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 28,
        }}
      >
        <button
          type="button"
          onClick={handleGoHome}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent-brass-hi)',
            fontFamily: 'var(--font-ui)',
            fontSize: 13,
            fontWeight: 700,
            padding: '4px 8px',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          ← Back
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 400,
            color: 'var(--text-parchment)',
            margin: 0,
            letterSpacing: 1,
          }}
        >
          Shop
        </h1>
        {proActive ? <ProBadge /> : <span style={{ width: 40 }} />}
      </header>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: 12,
          marginBottom: 4,
        }}
      >
        <Mostaccio pose="point" scale={3} />
      </div>

      <p
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 11,
          color: 'var(--text-ash)',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          textAlign: 'center',
          marginTop: 0,
          marginBottom: 18,
        }}
      >
        — Mostaccio’s general store —
      </p>

      <Section title="Replay">
        <ShopCard
          title="Extra game today"
          description={
            proActive
              ? 'Word Pro already gives you unlimited daily plays.'
              : "Play today's puzzle one more time."
          }
          badge={
            proActive
              ? 'Included with Pro'
              : replayCredits > 0
                ? `${replayCredits} owned`
                : null
          }
          buyLabel={
            replayCredits > 0
              ? `Buy more · ${REPLAY_PRICE_STARS} ⭐`
              : `Buy · ${REPLAY_PRICE_STARS} ⭐`
          }
          onBuy={handleBuyReplay}
        />
      </Section>

      <Section title="Themes">
        <p
          style={{
            fontSize: 11,
            color: 'var(--text-parchment-dim)',
            margin: '0 0 10px 0',
            lineHeight: 1.4,
          }}
        >
          Switch the whole room. Tap a theme you own to apply it.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {THEME_CATALOG.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              owned={theme.id === 'default' || ownedThemes.includes(theme.id)}
              active={selectedTheme === theme.id}
              proActive={proActive}
              onApply={() => handleApplyTheme(theme.id)}
              onBuy={() => handleBuyTheme(theme.id)}
            />
          ))}
        </div>
      </Section>

      <Section title="Boosts">
        <ShopCard
          title="Double Score"
          description="Multiply the score of your next game today by 2×."
          badge={doubleScoreActive ? 'Active today' : null}
          buyLabel={`Buy · ${DOUBLE_SCORE_PRICE_STARS} ⭐`}
          onBuy={handleBuyDoubleScore}
        />
      </Section>

      <Section title="Subscription">
        <ProCard
          active={proActive}
          expiresAt={proExpiresAt}
          onBuy={handleBuyPro}
        />
      </Section>

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 24,
          paddingInline: 18,
        }}
      >
        <Card surface="table" padding={4} bordered>
          <TabBar active="shop" onChange={handleTabChange} />
        </Card>
      </div>
    </main>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: 18 }}>
      <h2
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 11,
          color: 'var(--accent-brass)',
          letterSpacing: 2,
          textTransform: 'uppercase',
          margin: '0 0 8px 4px',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

interface ShopCardProps {
  title: string
  description: string
  badge?: string | null
  buyLabel: string
  onBuy: () => void
}

function ShopCard({
  title,
  description,
  badge,
  buyLabel,
  onBuy,
}: ShopCardProps) {
  return (
    <Card surface="table" padding={14}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 400,
            margin: 0,
            color: 'var(--text-parchment)',
            lineHeight: 1.2,
          }}
        >
          {title}
        </h3>
        {badge && <Badge tone="brass">{badge}</Badge>}
      </div>
      <p
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 13,
          color: 'var(--text-parchment-dim)',
          margin: '0 0 12px 0',
          lineHeight: 1.4,
        }}
      >
        {description}
      </p>
      <SaloonButton variant="primary" size="md" fullWidth onClick={onBuy}>
        {buyLabel}
      </SaloonButton>
    </Card>
  )
}

interface ThemeCardProps {
  theme: ThemeCatalogEntry
  owned: boolean
  active: boolean
  proActive: boolean
  onApply: () => void
  onBuy: () => void
}

function ThemeCard({
  theme,
  owned,
  active,
  proActive,
  onApply,
  onBuy,
}: ThemeCardProps) {
  return (
    <Card
      surface="table"
      padding={12}
      style={
        active
          ? {
              borderColor: 'var(--accent-lamp)',
              boxShadow: '0 0 18px rgba(255,140,66,0.3), 0 4px 12px rgba(0,0,0,0.3)',
            }
          : undefined
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ThemePreview palette={theme.preview} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                fontWeight: 400,
                margin: 0,
                color: 'var(--text-parchment)',
                lineHeight: 1.2,
              }}
            >
              {theme.title}
            </h3>
            {active && <Badge tone="lamp">Active</Badge>}
          </div>
          <p
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 9,
              color: 'var(--text-ash)',
              letterSpacing: 1,
              textTransform: 'uppercase',
              margin: '2px 0 2px 0',
            }}
          >
            {theme.flavour}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 12,
              color: 'var(--text-parchment-dim)',
              margin: 0,
              lineHeight: 1.35,
            }}
          >
            {theme.description}
          </p>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        {owned || proActive ? (
          <SaloonButton
            variant={active ? 'ghost' : 'secondary'}
            size="sm"
            fullWidth
            onClick={active ? undefined : onApply}
            disabled={active}
          >
            {active ? '✓ Applied' : 'Apply'}
          </SaloonButton>
        ) : (
          <SaloonButton variant="primary" size="sm" fullWidth onClick={onBuy}>
            Buy · {THEME_PRICE_STARS} ⭐
          </SaloonButton>
        )}
      </div>
    </Card>
  )
}

// Маленький круглый preview-тайл темы. Использует цвета палитры темы напрямую,
// не CSS-переменные — чтобы каждая карточка могла показать СВОЙ стиль на одном
// экране (CSS-переменные применяются глобально через [data-theme]).
function ThemePreview({ palette }: { palette: ThemePalette }) {
  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        flexShrink: 0,
        border: `3px solid ${palette.border}`,
        background: `radial-gradient(circle at 38% 32%, ${palette.bgInner} 0%, ${palette.bgOuter} 95%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-pixel)',
        fontWeight: 700,
        fontSize: 26,
        color: palette.text,
        textShadow: `0 0 6px ${palette.glow}, 0 0 14px ${palette.glow}`,
        boxShadow: [
          '0 4px 0 rgba(0,0,0,.5)',
          'inset 0 -3px 8px rgba(0,0,0,.65)',
          'inset 0 2px 4px rgba(255,255,255,.18)',
        ].join(', '),
        lineHeight: 1,
      }}
    >
      A
    </div>
  )
}

interface ProCardProps {
  active: boolean
  expiresAt: string | null
  onBuy: () => void
}

// Premium-карточка для подписки. Brass-gold trim, корона в уголке,
// контрастно сильнее обычных Card'ов чтобы не теряться в списке.
function ProCard({ active, expiresAt, onBuy }: ProCardProps) {
  const expiryLabel =
    active && expiresAt
      ? new Date(expiresAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        })
      : null
  return (
    <div
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, #3a2818 0%, #1a1108 100%)',
        borderRadius: 14,
        border: '1.5px solid rgba(212,168,73,0.7)',
        boxShadow:
          '0 0 18px rgba(212,168,73,0.25), 0 6px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        padding: 16,
        color: 'var(--text-parchment)',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -14,
          right: -14,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(232,192,98,0.35) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 400,
              margin: 0,
              color: 'var(--accent-brass-hi)',
              textShadow: '0 0 10px rgba(212,168,73,0.5)',
              lineHeight: 1.1,
            }}
          >
            Word Pro
          </h3>
          <p
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 10,
              color: 'var(--accent-brass)',
              letterSpacing: 2,
              textTransform: 'uppercase',
              margin: '4px 0 0 0',
            }}
          >
            {PRO_PRICE_STARS} ⭐ / month
          </p>
        </div>
        <ProBadge />
      </div>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '12px 0 14px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {[
          'Unlimited daily plays',
          'All themes unlocked',
          'Pro-only leaderboard',
          'Extended stats',
        ].map((line) => (
          <li
            key={line}
            style={{
              display: 'flex',
              gap: 8,
              fontFamily: 'var(--font-ui)',
              fontSize: 13,
              color: 'var(--text-parchment-dim)',
              lineHeight: 1.4,
            }}
          >
            <span style={{ color: 'var(--accent-brass-hi)' }}>★</span>
            {line}
          </li>
        ))}
      </ul>
      {active && expiryLabel && (
        <div
          style={{
            display: 'inline-block',
            fontFamily: 'var(--font-pixel)',
            fontSize: 10,
            letterSpacing: 1.5,
            color: 'var(--accent-brass-hi)',
            textTransform: 'uppercase',
            background: 'rgba(212,168,73,0.15)',
            border: '1px solid rgba(212,168,73,0.4)',
            borderRadius: 999,
            padding: '4px 10px',
            marginBottom: 12,
          }}
        >
          Active · until {expiryLabel}
        </div>
      )}
      <SaloonButton variant="primary" size="md" fullWidth onClick={onBuy}>
        {active ? `Renew · ${PRO_PRICE_STARS} ⭐` : `Subscribe · ${PRO_PRICE_STARS} ⭐`}
      </SaloonButton>
    </div>
  )
}

// Бейдж в углу карточки. Два тона: brass (нейтральный «у вас уже есть»)
// и lamp (огненный — «эта тема прямо сейчас активна»).
function Badge({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'brass' | 'lamp'
}) {
  const isLamp = tone === 'lamp'
  return (
    <span
      style={{
        fontFamily: 'var(--font-pixel)',
        fontSize: 9,
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        color: isLamp ? 'var(--accent-lamp-hi)' : 'var(--accent-brass-hi)',
        background: isLamp
          ? 'rgba(255,140,66,0.18)'
          : 'rgba(212,168,73,0.18)',
        border: isLamp
          ? '1px solid rgba(255,140,66,0.55)'
          : '1px solid rgba(212,168,73,0.55)',
        borderRadius: 999,
        padding: '3px 8px',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  )
}
