// Запускает поллинг смены UTC-дня раз в минуту + проверку при возврате
// из background (visibilitychange). Когда дата меняется — обновляет
// seed/letters/todayStatus в store и зовёт refreshTodayStatus.
//
// Подключаем на каждом «живом» экране (Home/Result/Shop/Me), чтобы
// в момент полуночи UI сразу переключился на новый день — и юзеру не
// приходилось перезапускать Mini App.

import { useEffect } from 'react'
import { useGameStore } from '../store/useGameStore'

const ROLLOVER_CHECK_INTERVAL_MS = 60_000

export function useDayRollover(initData: string | undefined): void {
  const rolloverDayIfNeeded = useGameStore((s) => s.rolloverDayIfNeeded)
  const refreshTodayStatus = useGameStore((s) => s.refreshTodayStatus)

  useEffect(() => {
    const handle = () => {
      const rolled = rolloverDayIfNeeded()
      if (rolled && initData) {
        void refreshTodayStatus(initData)
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') handle()
    }
    document.addEventListener('visibilitychange', onVisible)
    const id = setInterval(handle, ROLLOVER_CHECK_INTERVAL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(id)
    }
  }, [initData, rolloverDayIfNeeded, refreshTodayStatus])
}
