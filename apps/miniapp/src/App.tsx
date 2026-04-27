// Корневой компонент. Оборачивает HomeScreen в ErrorBoundary, чтобы
// поймать ошибку SDK при запуске вне Telegram и показать понятный fallback.

import { Component, type ReactNode } from 'react'
import HomeScreen from './screens/HomeScreen'
import GameScreen from './screens/GameScreen'
import ResultScreen from './screens/ResultScreen'
import { useGameStore } from './store/useGameStore'

type State = { hasError: boolean }

class TelegramErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return <OpenInTelegramFallback />
    return this.props.children
  }
}

function OpenInTelegramFallback() {
  return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6 text-white">
      <div className="max-w-sm text-center">
        <h1 className="text-3xl font-bold mb-3">Open in Telegram</h1>
        <p className="text-slate-300">
          Word Royale runs inside Telegram. Open <span className="text-purple-300">@word_royale_bot</span> and tap Play.
        </p>
      </div>
    </main>
  )
}

function ActiveScreen() {
  const screen = useGameStore((s) => s.screen)
  if (screen === 'game') return <GameScreen />
  if (screen === 'result') return <ResultScreen />
  return <HomeScreen />
}

export default function App() {
  return (
    <TelegramErrorBoundary>
      <ActiveScreen />
    </TelegramErrorBoundary>
  )
}
