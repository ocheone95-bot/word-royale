// Shop-экран. Показывает каталог IAP: replay-кредиты, темы букв, double score, Word Pro.
// Каждая позиция — карточка с названием, описанием, ценой и кнопкой Buy.
// Покупка идёт через бот: deep-link `t.me/word_royale_bot?start=buy_<product>`,
// бот шлёт Stars-инвойс. После оплаты юзер возвращается, today-status обновляется
// на visibilitychange и кнопка переключается на «Owned» / «Apply».

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

const REPLAY_PRICE_STARS = 50
const THEME_PRICE_STARS = 100

interface ThemeCatalogEntry {
  id: ThemeId
  title: string
  description: string
}

// 'default' идёт первой — она бесплатна и активна по умолчанию.
const THEME_CATALOG: readonly ThemeCatalogEntry[] = [
  { id: 'default', title: 'Classic', description: 'The original purple style. Free for everyone.' },
  { id: 'neon', title: 'Neon', description: 'Cyan glow letters on a dark canvas.' },
  { id: 'retro', title: 'Retro', description: 'Warm sepia letters with a vintage feel.' },
  { id: 'sakura', title: 'Sakura', description: 'Soft pink blossom palette.' },
  { id: 'cyberpunk', title: 'Cyberpunk', description: 'Magenta + neon yellow contrast.' },
] as const

export default function ShopScreen() {
  const initData = useRawInitData()
  const goHome = useGameStore((s) => s.goHome)
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
  const doubleScoreActive =
    todayStatus.loaded && todayStatus.doubleScoreActive
  const proActive = todayStatus.loaded && todayStatus.proActive
  const proExpiresAt = todayStatus.loaded ? todayStatus.proExpiresAt : null

  const handleBuyReplay = () => {
    track('iap_initiated', { product_id: 'replay', price_stars: REPLAY_PRICE_STARS, source: 'shop' })
    openTelegramLink(buildBuyReplayDeepLink())
  }
  const handleBuyTheme = (id: ThemeId) => {
    track('iap_initiated', { product_id: `theme_${id}`, price_stars: THEME_PRICE_STARS, source: 'shop' })
    openTelegramLink(buildBuyThemeDeepLink(id))
  }
  const handleBuyDoubleScore = () => {
    track('iap_initiated', { product_id: 'double_score', price_stars: 200, source: 'shop' })
    openTelegramLink(buildBuyDeepLink('double_score'))
  }
  const handleBuyPro = () => {
    track('iap_initiated', { product_id: 'pro_subscription', price_stars: 150, source: 'shop' })
    openTelegramLink(buildBuyDeepLink('pro_subscription'))
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 px-6 py-8 text-white">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={goHome}
            className="text-purple-300 active:scale-95 transition text-sm"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold">Shop</h1>
          <div className="w-10" />
        </div>

        <Section title="Replay">
          <ShopCard
            title="Extra game today"
            description={
              proActive
                ? 'Word Pro already gives you unlimited daily plays.'
                : "Play today's puzzle one more time."
            }
            price={`${REPLAY_PRICE_STARS} ⭐`}
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
          <p className="text-xs text-slate-400 mb-3">
            Letter style for the game board. Tap a theme you own to apply it.
          </p>
          <div className="space-y-3">
            {THEME_CATALOG.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                owned={theme.id === 'default' || ownedThemes.includes(theme.id)}
                active={selectedTheme === theme.id}
                onApply={() => setSelectedTheme(theme.id)}
                onBuy={() => handleBuyTheme(theme.id)}
              />
            ))}
          </div>
        </Section>

        <Section title="Boosts">
          <ShopCard
            title="Double Score"
            description="Multiply the score of your next game today by 2×."
            price="200 ⭐"
            badge={doubleScoreActive ? 'Active' : null}
            onBuy={handleBuyDoubleScore}
          />
        </Section>

        <Section title="Subscription">
          <ShopCard
            title="Word Pro"
            description="Unlimited daily plays + all themes for one month."
            price="150 ⭐ / month"
            badge={
              proActive && proExpiresAt
                ? `Active · until ${new Date(proExpiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                : null
            }
            buyLabel={proActive ? 'Renew · 150 ⭐' : 'Buy · 150 ⭐ / month'}
            onBuy={handleBuyPro}
          />
        </Section>
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
    <section className="mb-6">
      <h2 className="text-xs uppercase tracking-widest text-slate-400 mb-2">
        {title}
      </h2>
      {children}
    </section>
  )
}

interface ShopCardProps {
  title: string
  description: string
  price: string
  badge?: string | null
  buyLabel?: string
  disabled?: boolean
  disabledLabel?: string
  onBuy?: () => void
}

function ShopCard({
  title,
  description,
  price,
  badge,
  buyLabel,
  disabled,
  disabledLabel,
  onBuy,
}: ShopCardProps) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        {badge && (
          <span className="text-xs bg-purple-600/30 text-purple-200 px-2 py-1 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-400 mb-3">{description}</p>
      <button
        type="button"
        onClick={disabled ? undefined : onBuy}
        disabled={disabled}
        className={
          disabled
            ? 'w-full bg-slate-700/50 text-slate-500 py-3 rounded-xl text-sm font-medium cursor-not-allowed'
            : 'w-full bg-amber-500 hover:bg-amber-400 active:scale-95 transition py-3 rounded-xl text-base font-semibold text-slate-900'
        }
      >
        {disabled ? (disabledLabel ?? 'Coming soon') : (buyLabel ?? `Buy · ${price}`)}
      </button>
    </div>
  )
}

interface ThemeCardProps {
  theme: ThemeCatalogEntry
  owned: boolean
  active: boolean
  onApply: () => void
  onBuy: () => void
}

function ThemeCard({ theme, owned, active, onApply, onBuy }: ThemeCardProps) {
  return (
    <div
      className={`bg-slate-800/60 border rounded-2xl p-4 ${
        active ? 'border-purple-400' : 'border-slate-700'
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <ThemePreview themeId={theme.id} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold truncate">{theme.title}</h3>
            {active && (
              <span className="text-[10px] uppercase tracking-wider bg-purple-600/30 text-purple-200 px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">{theme.description}</p>
        </div>
      </div>
      {owned ? (
        <button
          type="button"
          onClick={active ? undefined : onApply}
          disabled={active}
          className={
            active
              ? 'w-full bg-slate-700/50 text-slate-400 py-2 rounded-xl text-sm font-medium cursor-default'
              : 'w-full border border-purple-500 text-purple-200 hover:bg-purple-500/10 active:scale-95 transition py-2 rounded-xl text-sm font-medium'
          }
        >
          {active ? '✓ Applied' : 'Apply'}
        </button>
      ) : (
        <button
          type="button"
          onClick={onBuy}
          className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95 transition py-2 rounded-xl text-sm font-semibold text-slate-900"
        >
          Buy · {THEME_PRICE_STARS} ⭐
        </button>
      )}
    </div>
  )
}

// Маленький preview-тайл темы. Рендерит мини-LetterTile с CSS-переменными
// конкретной темы — даём юзеру понять стиль, не применяя его на весь экран.
function ThemePreview({ themeId }: { themeId: ThemeId }) {
  const themeAttr = themeId === 'default' ? undefined : { 'data-theme': themeId }
  return (
    <div
      {...themeAttr}
      className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold border"
      style={{
        background: 'var(--tile-bg-selected)',
        borderColor: 'var(--tile-border-selected)',
        color: 'var(--tile-text-selected)',
        boxShadow: '0 4px 8px -2px var(--tile-shadow-selected)',
      }}
    >
      A
    </div>
  )
}
