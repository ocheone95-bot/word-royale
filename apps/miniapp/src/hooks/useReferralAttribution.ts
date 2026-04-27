// Один раз за сессию выстреливает запросом в record-referral, если Mini App
// был открыт по ссылке вида `t.me/word_royale_bot/play?startapp=ref_<id>`.
// Дублирующие сессии бэкенду безвредны (PK на (referrer_id, referred_id)
// гарантирует идемпотентность), но не имеет смысла слать одно и то же при
// каждом ре-рендере.
//
// start_param парсим прямо из raw-initData (URLSearchParams), а не через
// типизированный useLaunchParams — там это `unknown` в текущей версии SDK,
// и сужать тип каждый апгрейд накладно.

import { useEffect } from 'react'
import { useRawInitData } from '@telegram-apps/sdk-react'
import { recordReferral } from '../lib/api'
import { parseReferralStartParam } from '../lib/share'

const SESSION_KEY = 'wr.referralSent.v1'

function readStartParam(initData: string): string | null {
  try {
    return new URLSearchParams(initData).get('start_param')
  } catch {
    return null
  }
}

export function useReferralAttribution(): void {
  const initData = useRawInitData()

  useEffect(() => {
    if (!initData) return
    const startParam = readStartParam(initData)
    if (!startParam) return
    if (parseReferralStartParam(startParam) == null) return

    try {
      if (sessionStorage.getItem(SESSION_KEY)) return
      // Помечаем оптимистично — даже если сеть упадёт, не долбимся в течение
      // одной сессии. PK на стороне БД сделает повтор no-op в следующей.
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // sessionStorage может быть недоступен в эфемерных webview — едем без кэша.
    }

    void recordReferral(initData, startParam)
  }, [initData])
}
