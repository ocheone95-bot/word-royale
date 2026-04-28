// Хранение «прошёл ли юзер онбординг» с синком между устройствами.
// Fallback chain: Telegram CloudStorage → localStorage → default false (показать).
//
// CloudStorage появился в Bot API 6.9 (апрель 2023). На desktop с старой
// версией клиента метод может быть undefined — тогда работаем как раньше,
// только через localStorage.

const LOCAL_KEY = 'wr.onboarding.done.v1'
// CloudStorage keys: A-Z, a-z, 0-9, _, - (точка не разрешена).
const CLOUD_KEY = 'wr_onboarding_done'

interface CloudStorageAPI {
  getItem: (
    key: string,
    cb: (err: string | null, val: string | null | undefined) => void,
  ) => void
  setItem: (
    key: string,
    value: string,
    cb?: (err: string | null, ok?: boolean) => void,
  ) => void
}

interface WebApp {
  CloudStorage?: CloudStorageAPI
}

interface WindowWithTelegram {
  Telegram?: { WebApp?: WebApp }
}

function getCloudStorage(): CloudStorageAPI | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as WindowWithTelegram
  return w.Telegram?.WebApp?.CloudStorage ?? null
}

function readLocal(): boolean | null {
  try {
    const v = localStorage.getItem(LOCAL_KEY)
    if (v === '1') return true
    return null
  } catch {
    return null
  }
}

function writeLocal(): void {
  try {
    localStorage.setItem(LOCAL_KEY, '1')
  } catch {
    // localStorage недоступен — не критично, CloudStorage перекроет.
  }
}

// Загружает флаг «онбординг пройден». Сначала пытается CloudStorage
// (синк между устройствами), при отказе — localStorage. Если ни один
// не помог — default false (показать новичку).
//
// Side-effect: если CloudStorage пуст, но localStorage говорит «done»,
// пишем в облако чтобы переключение клиентов работало.
// И наоборот — если облако сказало «done», пишем в localStorage чтобы
// следующий маунт даже без CloudStorage не показал онбординг повторно.
export function loadOnboardingDone(): Promise<boolean> {
  return new Promise((resolve) => {
    const cs = getCloudStorage()
    if (!cs) {
      resolve(readLocal() === true)
      return
    }
    let settled = false
    const finalize = (done: boolean) => {
      if (settled) return
      settled = true
      resolve(done)
    }
    try {
      cs.getItem(CLOUD_KEY, (err, val) => {
        if (err) {
          finalize(readLocal() === true)
          return
        }
        if (val === '1') {
          // Облако источник правды → синхронизируем локально.
          writeLocal()
          finalize(true)
          return
        }
        // Облако пусто или val другой. Если локально done — заодно
        // подтянем в облако чтобы следующий клиент тоже знал.
        const local = readLocal() === true
        if (local) {
          try {
            cs.setItem(CLOUD_KEY, '1')
          } catch {
            // не критично
          }
        }
        finalize(local)
      })
    } catch {
      finalize(readLocal() === true)
    }
  })
}

// Помечает онбординг пройденным в обоих хранилищах. localStorage — синхронно,
// чтобы перенести ремаунт. CloudStorage — fire-and-forget, callback не ждём.
export function markOnboardingDone(): void {
  writeLocal()
  const cs = getCloudStorage()
  if (!cs) return
  try {
    cs.setItem(CLOUD_KEY, '1')
  } catch {
    // не критично
  }
}
