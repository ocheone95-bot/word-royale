// День N от запуска проекта. Считается от LAUNCH_DATE до seed (UTC).
// Используется на HomeScreen для «Day 184» и в share-тексте.

const LAUNCH_DATE = '2026-04-26'

export function dayNumberSinceLaunch(seed: string): number {
  const launch = new Date(LAUNCH_DATE + 'T00:00:00Z').getTime()
  const today = new Date(seed + 'T00:00:00Z').getTime()
  return Math.max(1, Math.round((today - launch) / 86_400_000) + 1)
}
