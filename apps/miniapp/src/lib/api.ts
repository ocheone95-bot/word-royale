// API-клиент Word Royale: серверные вызовы через fetch + чтение лидерборда
// напрямую из Supabase под anon-ключом (RLS открывает SELECT на users
// и game_sessions).

import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

function functionUrl(name: string): string | null {
  if (!SUPABASE_URL) return null
  return `${SUPABASE_URL}/functions/v1/${name}`
}

function functionHeaders(): Record<string, string> | null {
  if (!SUPABASE_ANON_KEY) return null
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  }
}

export interface SubmitSessionPayload {
  initData: string
  dailySeed: string
  letters: string[]
  wordsFound: string[]
  score: number
  durationSec: number
  // Минуты от UTC, положительный для Восточных. Сервер пишет в users.tz_offset_min,
  // используется daily-reminder для поиска юзеров с локальным 09:00.
  tzOffsetMin?: number
}

// streakReward возможные значения:
//   'replay_credit' — +1 replay credit (3 day streak)
//   'theme_neon'    — бесплатная тема neon (7 day streak)
//   'pro_30d'       — Word Pro на 30 дней (30 day streak)
//   null            — milestone не пересечён или RPC не выдала награду (race)
export type StreakRewardType = 'replay_credit' | 'theme_neon' | 'pro_30d'

export interface SubmitSessionSuccess {
  ok: true
  score: number
  wordsCount: number
  seed: string
  wasReplay: boolean
  replayCreditsLeft: number
  doubleScoreUsed: boolean
  currentStreak: number
  streakMilestoneReached: number
  streakReward: StreakRewardType | null
  proTrialGranted: boolean
  proTrialExpiresAt: string | null
}

export interface SubmitSessionFailure {
  ok: false
  error: string
  detail?: string
  status?: number
  [key: string]: unknown
}

export type SubmitSessionResult = SubmitSessionSuccess | SubmitSessionFailure

export async function submitSession(
  payload: SubmitSessionPayload,
): Promise<SubmitSessionResult> {
  const url = functionUrl('submit-score')
  const headers = functionHeaders()
  if (!url || !headers) {
    return { ok: false, error: 'env_missing' }
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
  } catch (e) {
    return { ok: false, error: 'network', detail: String(e) }
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return { ok: false, error: 'bad_response', status: res.status }
  }

  if (!res.ok || !(json as { ok?: boolean })?.ok) {
    const j = (json ?? {}) as Record<string, unknown>
    return {
      ok: false,
      error: (j.error as string) ?? 'http_error',
      status: res.status,
      ...j,
    }
  }

  const j = json as Record<string, unknown>
  const rewardRaw = j.streakReward
  const reward: StreakRewardType | null =
    rewardRaw === 'replay_credit' ||
    rewardRaw === 'theme_neon' ||
    rewardRaw === 'pro_30d'
      ? rewardRaw
      : null
  return {
    ok: true,
    score: Number(j.score ?? 0),
    wordsCount: Number(j.wordsCount ?? 0),
    seed: String(j.seed ?? ''),
    wasReplay: Boolean(j.wasReplay),
    replayCreditsLeft: Number(j.replayCreditsLeft ?? 0),
    doubleScoreUsed: Boolean(j.doubleScoreUsed),
    currentStreak: Number(j.currentStreak ?? 0),
    streakMilestoneReached: Number(j.streakMilestoneReached ?? 0),
    streakReward: reward,
    proTrialGranted: Boolean(j.proTrialGranted),
    proTrialExpiresAt:
      typeof j.proTrialExpiresAt === 'string' ? j.proTrialExpiresAt : null,
  }
}

export interface TodayStatus {
  playedToday: boolean
  replayCredits: number
  freeGameAvailable: boolean
  themes: string[]
  doubleScoreActive: boolean
  proActive: boolean
  proExpiresAt: string | null
  adsWatchedToday: number
  adsMaxPerDay: number
  currentStreak: number
  bestStreak: number
  proTrialActive: boolean
  proTrialUsed: boolean
  weekStart: string
  weekEnd: string
  weeklyRank: number | null
  weeklyTotalScore: number | null
}

interface TodayStatusSuccess extends TodayStatus {
  ok: true
}
interface TodayStatusFailure {
  ok: false
  error: string
}

export type TodayStatusResult = TodayStatusSuccess | TodayStatusFailure

export async function fetchTodayStatus(
  initData: string,
  dailySeed: string,
): Promise<TodayStatusResult> {
  const url = functionUrl('today-status')
  const headers = functionHeaders()
  if (!url || !headers) return { ok: false, error: 'env_missing' }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ initData, dailySeed }),
    })
  } catch (e) {
    return { ok: false, error: 'network' + (e ? `:${String(e)}` : '') }
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return { ok: false, error: 'bad_response' }
  }

  const j = (json ?? {}) as Record<string, unknown>
  if (!res.ok || j.ok !== true) {
    return { ok: false, error: (j.error as string) ?? 'http_error' }
  }
  return {
    ok: true,
    playedToday: Boolean(j.playedToday),
    replayCredits: Number(j.replayCredits ?? 0),
    freeGameAvailable: Boolean(j.freeGameAvailable),
    themes: Array.isArray(j.themes) ? (j.themes as string[]) : [],
    doubleScoreActive: Boolean(j.doubleScoreActive),
    proActive: Boolean(j.proActive),
    proExpiresAt: typeof j.proExpiresAt === 'string' ? j.proExpiresAt : null,
    adsWatchedToday: Number(j.adsWatchedToday ?? 0),
    adsMaxPerDay: Number(j.adsMaxPerDay ?? 0),
    currentStreak: Number(j.currentStreak ?? 0),
    bestStreak: Number(j.bestStreak ?? 0),
    proTrialActive: Boolean(j.proTrialActive),
    proTrialUsed: Boolean(j.proTrialUsed),
    weekStart: typeof j.weekStart === 'string' ? j.weekStart : '',
    weekEnd: typeof j.weekEnd === 'string' ? j.weekEnd : '',
    weeklyRank:
      typeof j.weeklyRank === 'number' && Number.isFinite(j.weeklyRank)
        ? (j.weeklyRank as number)
        : null,
    weeklyTotalScore:
      typeof j.weeklyTotalScore === 'number' && Number.isFinite(j.weeklyTotalScore)
        ? (j.weeklyTotalScore as number)
        : null,
  }
}

export interface WeeklyEntry {
  rank: number
  telegramId: number
  username: string | null
  firstName: string | null
  photoUrl: string | null
  totalScore: number
  daysPlayed: number
  isSelf: boolean
}

interface WeeklyLeaderboardSuccess {
  ok: true
  weekStart: string
  weekEnd: string
  prizesDistributed: boolean
  entries: WeeklyEntry[]
  selfRank: number | null
  selfTotalScore: number | null
}

interface WeeklyLeaderboardFailure {
  ok: false
  error: string
}

export type WeeklyLeaderboardResult =
  | WeeklyLeaderboardSuccess
  | WeeklyLeaderboardFailure

export async function fetchWeeklyLeaderboard(
  initData: string,
  week: 'current' | 'previous' = 'current',
): Promise<WeeklyLeaderboardResult> {
  const url = functionUrl('weekly-leaderboard')
  const headers = functionHeaders()
  if (!url || !headers) return { ok: false, error: 'env_missing' }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ initData, week }),
    })
  } catch (e) {
    return { ok: false, error: 'network' + (e ? `:${String(e)}` : '') }
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return { ok: false, error: 'bad_response' }
  }

  const j = (json ?? {}) as Record<string, unknown>
  if (!res.ok || j.ok !== true) {
    return { ok: false, error: (j.error as string) ?? 'http_error' }
  }
  const entries = Array.isArray(j.entries)
    ? (j.entries as WeeklyEntry[])
    : []
  return {
    ok: true,
    weekStart: typeof j.weekStart === 'string' ? j.weekStart : '',
    weekEnd: typeof j.weekEnd === 'string' ? j.weekEnd : '',
    prizesDistributed: Boolean(j.prizesDistributed),
    entries,
    selfRank:
      typeof j.selfRank === 'number' && Number.isFinite(j.selfRank)
        ? (j.selfRank as number)
        : null,
    selfTotalScore:
      typeof j.selfTotalScore === 'number' && Number.isFinite(j.selfTotalScore)
        ? (j.selfTotalScore as number)
        : null,
  }
}

export interface MeStats {
  bestScore: number
  totalGames: number
  daysPlayed: number
  currentStreak: number
  bestStreak: number
  totalWordsFound: number
  longestWord: string | null
}

interface MeStatsSuccess extends MeStats {
  ok: true
}
interface MeStatsFailure {
  ok: false
  error: string
}
export type MeStatsResult = MeStatsSuccess | MeStatsFailure

export async function fetchMeStats(initData: string): Promise<MeStatsResult> {
  const url = functionUrl('me-stats')
  const headers = functionHeaders()
  if (!url || !headers) return { ok: false, error: 'env_missing' }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ initData }),
    })
  } catch (e) {
    return { ok: false, error: 'network' + (e ? `:${String(e)}` : '') }
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return { ok: false, error: 'bad_response' }
  }

  const j = (json ?? {}) as Record<string, unknown>
  if (!res.ok || j.ok !== true) {
    return { ok: false, error: (j.error as string) ?? 'http_error' }
  }
  return {
    ok: true,
    bestScore: Number(j.bestScore ?? 0),
    totalGames: Number(j.totalGames ?? 0),
    daysPlayed: Number(j.daysPlayed ?? 0),
    currentStreak: Number(j.currentStreak ?? 0),
    bestStreak: Number(j.bestStreak ?? 0),
    totalWordsFound: Number(j.totalWordsFound ?? 0),
    longestWord: typeof j.longestWord === 'string' ? j.longestWord : null,
  }
}

interface RecordAdRewardSuccess {
  ok: true
  allowed: boolean
  watchedToday: number
  maxPerDay: number
  replayCredits: number
}
interface RecordAdRewardFailure {
  ok: false
  error: string
}
export type RecordAdRewardResult = RecordAdRewardSuccess | RecordAdRewardFailure

export async function recordAdReward(
  initData: string,
): Promise<RecordAdRewardResult> {
  const url = functionUrl('record-ad-reward')
  const headers = functionHeaders()
  if (!url || !headers) return { ok: false, error: 'env_missing' }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ initData }),
    })
  } catch (e) {
    return { ok: false, error: 'network' + (e ? `:${String(e)}` : '') }
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return { ok: false, error: 'bad_response' }
  }

  const j = (json ?? {}) as Record<string, unknown>
  if (!res.ok || j.ok !== true) {
    return { ok: false, error: (j.error as string) ?? 'http_error' }
  }
  return {
    ok: true,
    allowed: Boolean(j.allowed),
    watchedToday: Number(j.watchedToday ?? 0),
    maxPerDay: Number(j.maxPerDay ?? 0),
    replayCredits: Number(j.replayCredits ?? 0),
  }
}

// Реф-атрибуция. Тихая операция: на ошибки не реагируем в UI, лоигрование
// в консоль помогает в проде через Sentry (когда подключим в Polish-неделе).
export async function recordReferral(
  initData: string,
  startParam: string,
): Promise<void> {
  const url = functionUrl('record-referral')
  const headers = functionHeaders()
  if (!url || !headers) return

  try {
    await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ initData, startParam }),
    })
  } catch (e) {
    // Не критично — атрибуция повторится при следующем заходе по той же ссылке.
    console.warn('record-referral failed', e)
  }
}

export interface LeaderboardEntry {
  telegramId: number
  username: string | null
  firstName: string | null
  photoUrl: string | null
  score: number
}

interface RawLeaderboardRow {
  score: number
  users:
    | {
        telegram_id: number
        username: string | null
        first_name: string | null
        photo_url: string | null
      }
    | null
}

export async function fetchDailyLeaderboard(
  dailySeed: string,
  limit = 100,
): Promise<LeaderboardEntry[]> {
  if (!supabase) return []

  // Берём с запасом — у одного юзера может быть несколько сессий за день
  // (повторные игры через Stars в будущем). Дедуп по telegram_id оставляет
  // лучший скор и потом обрезаем до limit.
  const { data, error } = await supabase
    .from('game_sessions')
    .select(
      'score, users!inner(telegram_id, username, first_name, photo_url)',
    )
    .eq('daily_seed', dailySeed)
    .order('score', { ascending: false })
    .limit(limit * 3)

  if (error || !data) return []

  const bestByUser = new Map<number, LeaderboardEntry>()
  for (const row of data as unknown as RawLeaderboardRow[]) {
    if (!row.users) continue
    const existing = bestByUser.get(row.users.telegram_id)
    if (existing && existing.score >= row.score) continue
    bestByUser.set(row.users.telegram_id, {
      telegramId: row.users.telegram_id,
      username: row.users.username,
      firstName: row.users.first_name,
      photoUrl: row.users.photo_url,
      score: row.score,
    })
  }

  return Array.from(bestByUser.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

interface FriendsLeaderboardSuccess {
  ok: true
  entries: LeaderboardEntry[]
}

interface FriendsLeaderboardFailure {
  ok: false
  error: string
}

export type FriendsLeaderboardResult =
  | FriendsLeaderboardSuccess
  | FriendsLeaderboardFailure

export async function fetchFriendsLeaderboard(
  initData: string,
  dailySeed: string,
): Promise<FriendsLeaderboardResult> {
  const url = functionUrl('friends-leaderboard')
  const headers = functionHeaders()
  if (!url || !headers) return { ok: false, error: 'env_missing' }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ initData, dailySeed }),
    })
  } catch (e) {
    return { ok: false, error: 'network' + (e ? `:${String(e)}` : '') }
  }

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return { ok: false, error: 'bad_response' }
  }

  const j = (json ?? {}) as Record<string, unknown>
  if (!res.ok || j.ok !== true) {
    return { ok: false, error: (j.error as string) ?? 'http_error' }
  }
  const entries = Array.isArray(j.entries) ? (j.entries as LeaderboardEntry[]) : []
  return { ok: true, entries }
}

