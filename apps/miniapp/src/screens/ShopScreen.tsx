// Shop-экран. Показывает каталог IAP: replay-кредиты, темы, double score, Word Pro.
// Каждая позиция — карточка с названием, описанием, ценой и кнопкой Buy.
// Покупка идёт через бот: deep-link `t.me/word_royale_bot?start=buy_<product>`,
// бот шлёт Stars-инвойс. После оплаты юзер возвращается, today-status обновляется
// на visibilitychange и кнопка переключается на «Owned» / «Active».

import { useEffect } from 'react'
import { useRawInitData } from '@telegram-apps/sdk-react'
import { useGameStore } from '../store/useGameStore'
import { buildBuyReplayDeepLink } from '../lib/share'
import { openTelegramLink } from '../lib/telegram'

const REPLAY_PRICE_STARS = 50

export default function ShopScreen() {
  const initData = useRawInitData()
  const goHome = useGameStore((s) => s.goHome)
  const todayStatus = useGameStore((s) => s.todayStatus)
  const refreshTodayStatus = useGameStore((s) => s.refreshTodayStatus)

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

  const handleBuyReplay = () => {
    openTelegramLink(buildBuyReplayDeepLink())
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

        <div className="space-y-4">
          <ShopCard
            title="Replay"
            description="Play today's puzzle one more time."
            price={`${REPLAY_PRICE_STARS} ⭐`}
            badge={replayCredits > 0 ? `${replayCredits} owned` : null}
            onBuy={handleBuyReplay}
          />

          <ShopCard
            title="Themes"
            description="Neon, retro, sakura, cyberpunk letter styles."
            price="100 ⭐"
            disabled
            disabledLabel="Coming soon"
          />

          <ShopCard
            title="Double Score"
            description="Multiply today's score by 2× on your next game."
            price="200 ⭐"
            disabled
            disabledLabel="Coming soon"
          />

          <ShopCard
            title="Word Pro"
            description="Unlimited daily plays, all themes, no rate limit."
            price="150 ⭐ / month"
            disabled
            disabledLabel="Coming soon"
          />
        </div>
      </div>
    </main>
  )
}

interface ShopCardProps {
  title: string
  description: string
  price: string
  badge?: string | null
  disabled?: boolean
  disabledLabel?: string
  onBuy?: () => void
}

function ShopCard({
  title,
  description,
  price,
  badge,
  disabled,
  disabledLabel,
  onBuy,
}: ShopCardProps) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
      <div className="flex items-start justify-between mb-2">
        <h2 className="text-lg font-semibold">{title}</h2>
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
        {disabled ? (disabledLabel ?? 'Coming soon') : `Buy · ${price}`}
      </button>
    </div>
  )
}
