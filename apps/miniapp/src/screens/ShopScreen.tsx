// Shop-экран. Сессия 14: новый grid-layout по handoff'у Claude Design Phase 3.
// Pro hero сверху как фокальная карточка, themes 2×2 grid с большой R-буквой
// в палитре каждой темы, replay tiers (1×/8×/12×) одной строкой, Boosts ниже.
// Neo-Tokyo как 5-я тема — отдельная full-width карточка под grid.

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
import { useDayRollover } from '../hooks/useDayRollover'
import {
  Card,
  ProBadge,
  SaloonButton,
  TabBar,
  type TabKey,
} from '../components/saloon'
import { t, useLang } from '../lib/i18n'

const REPLAY_PRICE_STARS = 50
const REPLAY_8_PRICE_STARS = 200
const REPLAY_12_PRICE_STARS = 400
const THEME_PRICE_STARS = 100
const DOUBLE_SCORE_PRICE_STARS = 200
const PRO_PRICE_STARS = 150

interface ThemeCatalogEntry {
  id: ThemeId
  title: string
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

const SALOON_THEME: ThemeCatalogEntry = {
  id: 'default',
  title: 'Saloon',
  flavour: 'default',
  description: 'Warm amber lamps and brass accents.',
  preview: {
    bgInner: '#3a2818',
    bgOuter: '#0a0604',
    border: '#d4a849',
    text: '#f4e4bc',
    glow: '#ffb84d',
  },
}

const NEON_THEME: ThemeCatalogEntry = {
  id: 'neon',
  title: 'Late Arcade',
  flavour: 'Neon',
  description: 'Cyan glow on midnight blue.',
  preview: {
    bgInner: '#15182c',
    bgOuter: '#04031a',
    border: '#42d4ff',
    text: '#9adfff',
    glow: '#42d4ff',
  },
}

const RETRO_THEME: ThemeCatalogEntry = {
  id: 'retro',
  title: "Diner '74",
  flavour: 'Retro',
  description: 'Mustard sign over sienna walls.',
  preview: {
    bgInner: '#5a2010',
    bgOuter: '#1a0c04',
    border: '#f4c542',
    text: '#f4e4bc',
    glow: '#c4541f',
  },
}

const SAKURA_THEME: ThemeCatalogEntry = {
  id: 'sakura',
  title: 'Kyoto',
  flavour: 'Sakura',
  description: 'Cherry-blossom pink on dark wood.',
  preview: {
    bgInner: '#5a2840',
    bgOuter: '#0a0508',
    border: '#ffb8d4',
    text: '#f4e4bc',
    glow: '#c44878',
  },
}

const NEO_TOKYO_THEME: ThemeCatalogEntry = {
  id: 'cyberpunk',
  title: 'Neo-Tokyo',
  flavour: 'Cyberpunk',
  description: 'Magenta + electric yellow on void.',
  preview: {
    bgInner: '#0a0010',
    bgOuter: '#000000',
    border: '#ff00ff',
    text: '#ffff00',
    glow: '#ff00ff',
  },
}

// Основные 4 темы в 2×2 grid + Neo-Tokyo как 5-я отдельной картой ниже.
const MAIN_THEMES: readonly ThemeCatalogEntry[] = [
  SALOON_THEME,
  NEON_THEME,
  RETRO_THEME,
  SAKURA_THEME,
] as const

export default function ShopScreen() {
  useLang()
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
  }, [initData, refreshTodayStatus])
  useDayRollover(initData ?? undefined)

  const ownedThemes = todayStatus.loaded ? todayStatus.themes : []
  const doubleScoreActive = todayStatus.loaded && todayStatus.doubleScoreActive
  const proActive = todayStatus.loaded && todayStatus.proActive
  const proExpiresAt = todayStatus.loaded ? todayStatus.proExpiresAt : null

  const handleBuyReplay = (productId: 'replay' | 'replay_8' | 'replay_12') => {
    hapticImpact('medium')
    const priceMap = {
      replay: REPLAY_PRICE_STARS,
      replay_8: REPLAY_8_PRICE_STARS,
      replay_12: REPLAY_12_PRICE_STARS,
    }
    track('iap_initiated', {
      product_id: productId,
      price_stars: priceMap[productId],
      source: 'shop',
    })
    openTelegramLink(
      productId === 'replay'
        ? buildBuyReplayDeepLink()
        : buildBuyDeepLink(productId),
    )
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
          ← {t('common.back')}
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
          {t('shop.title')}
        </h1>
        {proActive ? <ProBadge /> : <span style={{ width: 40 }} />}
      </header>

      {/* Pro hero — фокальная карточка наверху. Радиальный glow в углу
          плюс корона; CTA «BECOME PRO» при неактивной подписке, «Active until …»
          при активной. */}
      <ProHero active={proActive} expiresAt={proExpiresAt} onBuy={handleBuyPro} />

      <SectionTitle>{t('shop.themes_section')}</SectionTitle>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}
      >
        {MAIN_THEMES.map((theme) => (
          <ThemeGridCard
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

      <div style={{ marginTop: 10 }}>
        <ThemeWideCard
          theme={NEO_TOKYO_THEME}
          owned={ownedThemes.includes(NEO_TOKYO_THEME.id)}
          active={selectedTheme === NEO_TOKYO_THEME.id}
          proActive={proActive}
          onApply={() => handleApplyTheme(NEO_TOKYO_THEME.id)}
          onBuy={() => handleBuyTheme(NEO_TOKYO_THEME.id)}
        />
      </div>

      <SectionTitle>{t('shop.replay_section')}</SectionTitle>
      <div style={{ display: 'flex', gap: 8 }}>
        <ReplayTier
          qty={1}
          price={REPLAY_PRICE_STARS}
          discount={null}
          onBuy={() => handleBuyReplay('replay')}
        />
        <ReplayTier
          qty={8}
          price={REPLAY_8_PRICE_STARS}
          discount="−50%"
          onBuy={() => handleBuyReplay('replay_8')}
        />
        <ReplayTier
          qty={12}
          price={REPLAY_12_PRICE_STARS}
          discount="−33%"
          onBuy={() => handleBuyReplay('replay_12')}
        />
      </div>

      <SectionTitle>{t('shop.boosts_section')}</SectionTitle>
      <ShopCard
        title="Double Score"
        description={t('shop.double_score_desc')}
        badge={doubleScoreActive ? t('shop.double_score_active') : null}
        buyLabel={t('shop.double_score_buy', { price: DOUBLE_SCORE_PRICE_STARS })}
        onBuy={handleBuyDoubleScore}
      />

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

function SectionTitle({ children }: { children: string }) {
  return (
    <h2
      style={{
        fontFamily: 'var(--font-pixel)',
        fontSize: 11,
        color: 'var(--accent-brass)',
        letterSpacing: 2,
        textTransform: 'uppercase',
        margin: '20px 0 10px 4px',
      }}
    >
      {children}
    </h2>
  )
}

interface ProHeroProps {
  active: boolean
  expiresAt: string | null
  onBuy: () => void
}

function ProHero({ active, expiresAt, onBuy }: ProHeroProps) {
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
          '0 0 22px rgba(212,168,73,0.35), 0 8px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
        padding: '18px 18px 16px',
        marginTop: 16,
        color: 'var(--text-parchment)',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 140,
          height: 140,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(232,192,98,0.4) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'absolute', top: 14, right: 14 }}>
        <ProBadge />
      </div>

      <div
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 9,
          color: 'var(--accent-brass)',
          letterSpacing: 2.5,
          textTransform: 'uppercase',
          marginTop: 4,
        }}
      >
        Word Royale
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 36,
          color: 'var(--accent-brass-hi)',
          textShadow: '0 0 12px rgba(212,168,73,0.6)',
          margin: '2px 0 6px 0',
          lineHeight: 1,
          letterSpacing: 2,
        }}
      >
        PRO
      </div>
      <p
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 12,
          color: 'var(--text-parchment-dim)',
          margin: '0 0 14px 0',
          lineHeight: 1.4,
        }}
      >
        {t('shop.pro_perks_unlimited')} · {t('shop.pro_perks_themes')} ·{' '}
        {t('shop.pro_perks_pro_board')} · {t('shop.pro_perks_no_ads')}
      </p>

      {active && expiryLabel ? (
        <div
          style={{
            display: 'inline-block',
            fontFamily: 'var(--font-pixel)',
            fontSize: 10,
            letterSpacing: 1.5,
            color: 'var(--accent-brass-hi)',
            textTransform: 'uppercase',
            background: 'rgba(212,168,73,0.18)',
            border: '1px solid rgba(212,168,73,0.4)',
            borderRadius: 999,
            padding: '6px 14px',
            marginTop: 4,
          }}
        >
          {t('shop.pro_active_until', { date: expiryLabel })}
        </div>
      ) : (
        <SaloonButton variant="primary" size="md" fullWidth onClick={onBuy}>
          {t('shop.pro_buy', { price: PRO_PRICE_STARS })}
        </SaloonButton>
      )}
    </div>
  )
}

interface ThemeGridCardProps {
  theme: ThemeCatalogEntry
  owned: boolean
  active: boolean
  proActive: boolean
  onApply: () => void
  onBuy: () => void
}

function ThemeGridCard({
  theme,
  owned,
  active,
  proActive,
  onApply,
  onBuy,
}: ThemeGridCardProps) {
  const accessible = owned || proActive
  const handleClick = () => {
    if (active) return
    if (accessible) onApply()
    else onBuy()
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={active}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '16px 10px 12px',
        background: `radial-gradient(circle at 50% 35%, ${theme.preview.bgInner} 0%, ${theme.preview.bgOuter} 95%)`,
        border: active
          ? `2px solid ${theme.preview.border}`
          : '1px solid rgba(212,168,73,0.25)',
        borderRadius: 12,
        boxShadow: active
          ? `0 0 18px ${hexAlpha(theme.preview.glow, 0.55)}, 0 6px 12px rgba(0,0,0,0.35)`
          : '0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
        color: 'var(--text-parchment)',
        cursor: active ? 'default' : 'pointer',
        WebkitTapHighlightColor: 'transparent',
        transition: 'transform 120ms ease-out, box-shadow 120ms ease-out',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          border: `3px solid ${theme.preview.border}`,
          background: `radial-gradient(circle at 38% 32%, ${theme.preview.bgInner} 0%, ${theme.preview.bgOuter} 95%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-pixel)',
          fontWeight: 700,
          fontSize: 32,
          color: theme.preview.text,
          textShadow: `0 0 6px ${theme.preview.glow}, 0 0 14px ${theme.preview.glow}`,
          boxShadow: [
            '0 4px 0 rgba(0,0,0,.5)',
            'inset 0 -3px 8px rgba(0,0,0,.65)',
            'inset 0 2px 4px rgba(255,255,255,.18)',
          ].join(', '),
          lineHeight: 1,
        }}
      >
        R
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 15,
          color: 'var(--text-parchment)',
          lineHeight: 1.1,
          textAlign: 'center',
        }}
      >
        {theme.title}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 9,
          color: theme.preview.border,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}
      >
        {active
          ? t('shop.theme_active')
          : owned
            ? `${t('shop.theme_owned')}${theme.id === 'default' ? ' · default' : ''}`
            : `${THEME_PRICE_STARS}⭐`}
      </div>
    </button>
  )
}

interface ThemeWideCardProps extends ThemeGridCardProps {}

function ThemeWideCard({
  theme,
  owned,
  active,
  proActive,
  onApply,
  onBuy,
}: ThemeWideCardProps) {
  const accessible = owned || proActive
  const handleClick = () => {
    if (active) return
    if (accessible) onApply()
    else onBuy()
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={active}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '12px 14px',
        background: `linear-gradient(90deg, ${theme.preview.bgInner} 0%, ${theme.preview.bgOuter} 100%)`,
        border: active
          ? `2px solid ${theme.preview.border}`
          : '1px solid rgba(212,168,73,0.25)',
        borderRadius: 12,
        boxShadow: active
          ? `0 0 16px ${hexAlpha(theme.preview.glow, 0.5)}`
          : '0 4px 10px rgba(0,0,0,0.35)',
        color: 'var(--text-parchment)',
        cursor: active ? 'default' : 'pointer',
        WebkitTapHighlightColor: 'transparent',
        textAlign: 'left',
      }}
    >
      <div
        style={{
          width: 50,
          height: 50,
          borderRadius: '50%',
          border: `3px solid ${theme.preview.border}`,
          background: `radial-gradient(circle at 38% 32%, ${theme.preview.bgInner} 0%, ${theme.preview.bgOuter} 95%)`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-pixel)',
          fontWeight: 700,
          fontSize: 24,
          color: theme.preview.text,
          textShadow: `0 0 6px ${theme.preview.glow}, 0 0 12px ${theme.preview.glow}`,
        }}
      >
        R
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            color: 'var(--text-parchment)',
            lineHeight: 1.1,
          }}
        >
          {theme.title}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 9,
            color: theme.preview.border,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginTop: 2,
          }}
        >
          {theme.flavour}
        </div>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 12,
          fontWeight: 700,
          color: active ? theme.preview.glow : 'var(--accent-brass-hi)',
          letterSpacing: 1,
        }}
      >
        {active
          ? t('shop.theme_active')
          : owned
            ? t('shop.theme_owned')
            : `${THEME_PRICE_STARS}⭐`}
      </div>
    </button>
  )
}

interface ReplayTierProps {
  qty: number
  price: number
  discount: string | null
  onBuy: () => void
}

function ReplayTier({ qty, price, discount, onBuy }: ReplayTierProps) {
  return (
    <button
      type="button"
      onClick={onBuy}
      style={{
        position: 'relative',
        flex: 1,
        background: 'var(--gradient-card-table)',
        border: '1px solid rgba(212,168,73,0.3)',
        borderRadius: 12,
        padding: '14px 8px 12px',
        color: 'var(--text-parchment)',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        textAlign: 'center',
        boxShadow: '0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {discount && (
        <span
          style={{
            position: 'absolute',
            top: -8,
            right: 6,
            background: 'var(--accent-lamp)',
            color: 'var(--text-charcoal)',
            fontFamily: 'var(--font-pixel)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.8,
            padding: '2px 6px',
            borderRadius: 999,
            boxShadow: '0 0 10px rgba(255,140,66,0.55)',
            whiteSpace: 'nowrap',
          }}
        >
          {discount}
        </span>
      )}
      <div
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 22,
          color: 'var(--accent-brass-hi)',
          textShadow: '0 0 8px rgba(212,168,73,0.4)',
          lineHeight: 1,
        }}
      >
        {qty}×
      </div>
      <div
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 9,
          color: 'var(--text-ash)',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          marginTop: 4,
        }}
      >
        replay
      </div>
      <div
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--accent-brass-hi)',
          marginTop: 8,
        }}
      >
        {price}⭐
      </div>
    </button>
  )
}

interface ShopCardProps {
  title: string
  description: string
  badge: string | null
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
        {badge && (
          <span
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 9,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: 'var(--accent-brass-hi)',
              background: 'rgba(212,168,73,0.18)',
              border: '1px solid rgba(212,168,73,0.55)',
              borderRadius: 999,
              padding: '3px 8px',
              whiteSpace: 'nowrap',
            }}
          >
            {badge}
          </span>
        )}
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

// Утилита: hex (#rrggbb) → rgba с указанной alpha. Для glow-shadow на
// theme-картах, чтобы не плодить ad-hoc rgba-литералы.
function hexAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return hex
  const intVal = parseInt(m[1], 16)
  const r = (intVal >> 16) & 0xff
  const g = (intVal >> 8) & 0xff
  const b = intVal & 0xff
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
