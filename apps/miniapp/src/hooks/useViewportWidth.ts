// Возвращает текущую ширину viewport (window.innerWidth) и обновляется
// по resize. На SSR/без window — возвращает 0 как «небольшой» дефолт,
// рендерим уменьшенную версию пока клиент не пришлёт реальное значение.

import { useEffect, useState } from 'react'

function readWidth(): number {
  if (typeof window === 'undefined') return 0
  return window.innerWidth
}

export function useViewportWidth(): number {
  const [width, setWidth] = useState<number>(() => readWidth())
  useEffect(() => {
    const onResize = () => setWidth(readWidth())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}
