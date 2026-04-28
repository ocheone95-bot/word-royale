// Monetag rewarded ads — обёртка SDK.
//
// Monetag для TMA подгружает скрипт `https://libtl.com/sdk.js?zone=<zoneId>`,
// который вешает на window глобал `show_<zoneId>(): Promise<void>`. Promise
// resolves когда юзер досмотрел рекламу до конца, rejects при abort.
//
// Чтобы не падать без ZONE_ID (env пустой → реклама выключена), все функции
// деградируют тихо: `isMonetagAvailable()` возвращает false и ничего не грузит.

const ZONE_ID = import.meta.env.VITE_MONETAG_ZONE_ID as string | undefined

let scriptLoaded = false
let scriptLoading: Promise<void> | null = null

export function isMonetagAvailable(): boolean {
  return Boolean(ZONE_ID)
}

function loadScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve()
  if (scriptLoading) return scriptLoading
  if (!ZONE_ID) return Promise.reject(new Error('Monetag zone id missing'))

  scriptLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://libtl.com/sdk.js?zone=${ZONE_ID}`
    script.async = true
    script.onload = () => {
      scriptLoaded = true
      resolve()
    }
    script.onerror = () => {
      scriptLoading = null
      reject(new Error('Monetag SDK failed to load'))
    }
    document.head.appendChild(script)
  })
  return scriptLoading
}

// Показ rewarded-ad. Resolves true при success, false при abort/недоступности.
// Любые ошибки SDK ловим и не пробрасываем — UX-кнопке ad'ов достаточно знать
// «дали бонус или нет».
export async function showRewardedAd(): Promise<boolean> {
  if (!ZONE_ID) return false
  try {
    await loadScript()
    const fn = (window as unknown as Record<string, unknown>)[`show_${ZONE_ID}`]
    if (typeof fn !== 'function') return false
    await (fn as () => Promise<void>)()
    return true
  } catch {
    return false
  }
}
