// Bottom TabBar — 4 таба (Home / Board / Shop / Me). Активный — accent-lamp
// glow на иконке + label цвета parchment. Inactive — ash 50%. Иконки
// сейчас text-glyphs (▣ ♛ ◆ ◉) — в Phase D можно заменить на pixel sprites
// или Lucide-иконки если PM захочет.

import type { CSSProperties, ReactNode } from 'react'
import { t } from '../../lib/i18n'

export type TabKey = 'home' | 'board' | 'shop' | 'me'

interface Tab {
  key: TabKey
  label: string
  glyph: ReactNode
}

function getTabs(): readonly Tab[] {
  return [
    { key: 'home', label: t('tab.home'), glyph: '⌂' },
    { key: 'board', label: t('tab.board'), glyph: '♛' },
    { key: 'shop', label: t('tab.shop'), glyph: '◆' },
    { key: 'me', label: t('tab.me'), glyph: '◉' },
  ]
}

interface TabBarProps {
  active: TabKey
  onChange: (key: TabKey) => void
  className?: string
  style?: CSSProperties
}

export function TabBar({ active, onChange, className, style }: TabBarProps) {
  const wrap: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingInline: 24,
    paddingBlock: 8,
    background: 'transparent',
    ...style,
  }
  return (
    <nav className={className} style={wrap} aria-label="Primary">
      {getTabs().map((tab) => (
        <TabButton
          key={tab.key}
          tab={tab}
          active={tab.key === active}
          onClick={() => onChange(tab.key)}
        />
      ))}
    </nav>
  )
}

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: Tab
  active: boolean
  onClick: () => void
}) {
  const color = active ? 'var(--accent-lamp)' : 'var(--text-ash)'
  const glyphStyle: CSSProperties = {
    fontSize: 22,
    lineHeight: 1,
    color,
    textShadow: active
      ? '0 0 8px var(--accent-lamp), 0 0 16px rgba(255,140,66,0.6)'
      : 'none',
    opacity: active ? 1 : 0.5,
  }
  const labelStyle: CSSProperties = {
    fontFamily: 'var(--font-pixel)',
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color,
    opacity: active ? 1 : 0.5,
    marginTop: 2,
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 4,
        cursor: 'pointer',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={glyphStyle}>{tab.glyph}</span>
      <span style={labelStyle}>{tab.label}</span>
    </button>
  )
}
