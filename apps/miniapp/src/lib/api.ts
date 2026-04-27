// API-клиент Word Royale.
// Сейчас — только submit-score; чтение лидерборда добавим следующим шагом.

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
