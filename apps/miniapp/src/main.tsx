// Точка входа Mini App. До рендера React-дерева инициализируем Telegram SDK,
// если приложение открыто внутри Telegram. Вне TMA (например, в обычном
// браузере по vercel.app URL) init не вызываем, а ErrorBoundary в App.tsx
// перехватит LaunchParamsRetrieveError из useLaunchParams и покажет fallback.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { init, isTMA } from '@telegram-apps/sdk-react'
import './index.css'
import App from './App.tsx'
import { initAnalytics, track } from './lib/analytics.ts'

if (isTMA()) {
  init()
}

initAnalytics()
track('app_opened')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
