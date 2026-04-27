// Возвращает данные текущего Telegram-юзера из initData.
// Бросает LaunchParamsRetrieveError, если приложение открыто вне Telegram —
// ErrorBoundary в App.tsx покажет fallback «Open in Telegram».

import { useLaunchParams } from '@telegram-apps/sdk-react'

export function useTelegramUser() {
  const lp = useLaunchParams(true)
  return lp.tgWebAppData?.user
}
