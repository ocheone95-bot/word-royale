// API-клиент Word Royale: серверные вызовы через fetch + чтение лидерборда
// напрямую из Supabase под anon-ключом (RLS открывает SELECT на users
// и game_sessions).

import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export interface SubmitSessionPayload {
  initData: string
  dailySeed: string
  letters: string[]
  wordsFound: string[]
  score: number
  durationSec: number
}

export interface SubmitSessionSuccess {
  ok: true
  score: number
  wordsCount: number
  seed: string
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
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, error: 'env_missing' }
  }

  const url = `${SUPABASE_URL}/functions/v1/submit-score`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
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

  return json as SubmitSessionSuccess
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

