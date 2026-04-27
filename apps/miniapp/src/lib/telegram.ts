// Тонкий шим над Telegram WebApp API. SDK-react v3 не публикует
// `openTelegramLink` как hook, а функция-обёртка из `@telegram-apps/sdk`
// не нужна целиком — нам хватает одного метода. Любую другую TMA-фичу
// в проекте по возможности подключаем через @telegram-apps/sdk-react.

interface TelegramWebAppLite {
  openTelegramLink?: (url: string) => void
}

interface WindowWithTelegram {
  Telegram?: { WebApp?: TelegramWebAppLite }
}

function getWebApp(): TelegramWebAppLite | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as WindowWithTelegram
  return w.Telegram?.WebApp ?? null
}

// Открывает t.me/-ссылку внутри Telegram-клиента (без выхода из приложения).
// Fallback на window.open — для случая запуска вне Telegram.
export function openTelegramLink(url: string): void {
  const wa = getWebApp()
  if (wa?.openTelegramLink) {
    wa.openTelegramLink(url)
    return
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
