// submit-score: серверная валидация игровой сессии и запись в БД.
//
// Контракт:
//   POST { initData, dailySeed, letters, wordsFound, score, durationSec } → JSON.
//
// Сервер не доверяет ничему из тела:
//   1) Подпись initData проверяется HMAC-SHA256 от bot_token.
//   2) dailySeed должен совпадать с серверным UTC-сегодняшним.
//   3) letters должен совпадать с детерминированным набором по этому seed.
//   4) Каждое слово: длина 3-7, без дублей, составимо из letters, есть в словаре.
//   5) score пересчитывается локально и сравнивается с присланным.
//
// Только после всех проверок: upsert юзера → insert сессии.
// Любая ошибка → 400/401/500 с машинно-читаемым кодом.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { verifyInitData } from '../_shared/verify-init-data.ts';
import {
  calculateTotalScore,
  getDailyLetters,
  getTodaySeed,
  isComposableFrom,
  MAX_WORD_LENGTH,
  MIN_WORD_LENGTH,
} from '../_shared/game.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SubmitScoreBody {
  initData: string;
  dailySeed: string;
  letters: string[];
  wordsFound: string[];
  score: number;
  durationSec: number;
  // Опционально — минуты от UTC, как `-new Date().getTimezoneOffset()`
  // (положительный для Восточных). Используется daily-reminder для поиска
  // юзеров, у которых сейчас 09:00 локально. Валидируется как |offset| <= 14*60.
  tzOffsetMin?: number;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isSubmitScoreBody(value: unknown): value is SubmitScoreBody {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.initData === 'string' &&
    typeof v.dailySeed === 'string' &&
    Array.isArray(v.letters) &&
    v.letters.every((l) => typeof l === 'string') &&
    Array.isArray(v.wordsFound) &&
    v.wordsFound.every((w) => typeof w === 'string') &&
    typeof v.score === 'number' &&
    typeof v.durationSec === 'number' &&
    (v.tzOffsetMin === undefined || typeof v.tzOffsetMin === 'number')
  );
}

// Валидный диапазон UTC-оффсета: ±14 часов. Любое значение вне диапазона
// считаем мусорным (битый клиент или подмена) и игнорируем — на уровне БД
// колонка остаётся как была.
function sanitizeTzOffset(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (Math.abs(rounded) > 14 * 60) return null;
  return rounded;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'method_not_allowed' });
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) {
    return jsonResponse(500, { ok: false, error: 'server_misconfigured' });
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { ok: false, error: 'server_misconfigured' });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid_json' });
  }
  if (!isSubmitScoreBody(body)) {
    return jsonResponse(400, { ok: false, error: 'invalid_body' });
  }
  const { initData, dailySeed, letters, wordsFound, score, durationSec } = body;
  const tzOffsetMin = sanitizeTzOffset(body.tzOffsetMin);

  const verified = await verifyInitData(initData, botToken);
  if (!verified) {
    return jsonResponse(401, { ok: false, error: 'invalid_init_data' });
  }

  const todaySeed = getTodaySeed();
  if (dailySeed !== todaySeed) {
    return jsonResponse(400, {
      ok: false,
      error: 'seed_mismatch',
      expected: todaySeed,
      got: dailySeed,
    });
  }

  const expectedLetters = getDailyLetters(todaySeed);
  if (
    letters.length !== expectedLetters.length ||
    letters.some((l, i) => l !== expectedLetters[i])
  ) {
    return jsonResponse(400, { ok: false, error: 'letters_mismatch' });
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const raw of wordsFound) {
    const w = raw.toLowerCase();
    if (w.length < MIN_WORD_LENGTH || w.length > MAX_WORD_LENGTH) {
      return jsonResponse(400, { ok: false, error: 'word_length', word: w });
    }
    if (seen.has(w)) {
      return jsonResponse(400, { ok: false, error: 'duplicate_word', word: w });
    }
    if (!isComposableFrom(w, expectedLetters)) {
      return jsonResponse(400, { ok: false, error: 'word_not_composable', word: w });
    }
    seen.add(w);
    normalized.push(w);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (normalized.length > 0) {
    const { data: dictRows, error: dictErr } = await supabase
      .from('dictionary_words')
      .select('word')
      .in('word', normalized);
    if (dictErr) {
      return jsonResponse(500, {
        ok: false,
        error: 'dictionary_query_failed',
        detail: dictErr.message,
      });
    }
    const validSet = new Set((dictRows ?? []).map((r) => r.word as string));
    const missing = normalized.filter((w) => !validSet.has(w));
    if (missing.length > 0) {
      return jsonResponse(400, {
        ok: false,
        error: 'words_not_in_dictionary',
        words: missing,
      });
    }
  }

  const expectedScore = calculateTotalScore(normalized);
  if (score !== expectedScore) {
    return jsonResponse(400, {
      ok: false,
      error: 'score_mismatch',
      expected: expectedScore,
      got: score,
    });
  }

  const tg = verified.user;
  const userPayload: Record<string, unknown> = {
    telegram_id: tg.id,
    username: tg.username ?? null,
    first_name: tg.first_name ?? null,
    photo_url: tg.photo_url ?? null,
    last_active_at: new Date().toISOString(),
  };
  if (tzOffsetMin !== null) {
    userPayload.tz_offset_min = tzOffsetMin;
  }
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .upsert(userPayload, { onConflict: 'telegram_id', ignoreDuplicates: false })
    .select('id')
    .single();
  if (userErr || !userRow) {
    return jsonResponse(500, {
      ok: false,
      error: 'user_upsert_failed',
      detail: userErr?.message,
    });
  }

  // Rate-limit «1 игра в день» + расход replay-токена решаются атомарно
  // в Postgres функции (миграция 0004). Возвращает result_code='no_replay',
  // если юзер уже играл сегодня и кредитов нет.
  const { data: rpcData, error: rpcErr } = await supabase.rpc('insert_game_session', {
    p_user_id: userRow.id,
    p_daily_seed: todaySeed,
    p_letters: expectedLetters.join(''),
    p_score: expectedScore,
    p_words_found: normalized,
    p_duration_sec: durationSec,
  });
  if (rpcErr) {
    return jsonResponse(500, {
      ok: false,
      error: 'session_insert_failed',
      detail: rpcErr.message,
    });
  }
  const row = Array.isArray(rpcData) && rpcData.length > 0 ? rpcData[0] : null;
  if (!row || typeof row !== 'object') {
    return jsonResponse(500, { ok: false, error: 'session_insert_failed', detail: 'no row' });
  }
  const result = row as {
    session_id: string | null;
    was_replay: boolean | null;
    replay_credits_left: number | null;
    result_code: string;
    score_applied: number | null;
    double_score_used: boolean | null;
    current_streak: number | null;
    streak_milestone_reached: number | null;
  };
  if (result.result_code === 'no_replay') {
    return jsonResponse(403, {
      ok: false,
      error: 'no_replay',
      message: 'You already played today. Buy a replay to play again.',
    });
  }
  if (result.result_code !== 'ok') {
    return jsonResponse(500, {
      ok: false,
      error: 'session_insert_failed',
      detail: result.result_code,
    });
  }

  // Реферальная награда: если этот юзер был приглашён кем-то и реферал
  // ещё не оплачен, начисляем referrer'у +1 replay credit. Идемпотентно;
  // ошибки RPC не считаем фатальными для submit-score.
  try {
    await supabase.rpc('grant_referral_reward', {
      p_referred_user_id: userRow.id,
      p_reward_credits: 1,
    });
  } catch {
    // ignore
  }

  // Streak-награда: insert_game_session помечает streak_milestone_reached>0,
  // когда юзер впервые перешагнул 3/7/30 day-порог. claim_streak_reward
  // атомарно начисляет (replay credit / тема / Pro 30d) с idempotency-check
  // через last_streak_milestone_reached. Ошибки не фатальны для submit-score.
  let streakReward: string | null = null;
  const milestoneReached = result.streak_milestone_reached ?? 0;
  if (milestoneReached > 0) {
    try {
      const { data: rewardRows } = await supabase.rpc('claim_streak_reward', {
        p_user_id: userRow.id,
        p_milestone: milestoneReached,
      });
      const rewardRow =
        Array.isArray(rewardRows) && rewardRows.length > 0 ? rewardRows[0] : null;
      if (rewardRow && (rewardRow as { granted?: boolean }).granted) {
        streakReward = (rewardRow as { reward_type?: string | null }).reward_type ?? null;
      }
    } catch {
      // ignore
    }
  }

  // score_applied = expectedScore × 2, если double_score_used=true. Возвращаем
  // клиенту его, чтобы UI и лидерборд показали один и тот же финальный счёт.
  return jsonResponse(200, {
    ok: true,
    score: result.score_applied ?? expectedScore,
    wordsCount: normalized.length,
    seed: todaySeed,
    wasReplay: result.was_replay ?? false,
    replayCreditsLeft: result.replay_credits_left ?? 0,
    doubleScoreUsed: result.double_score_used ?? false,
    currentStreak: result.current_streak ?? 0,
    streakMilestoneReached: milestoneReached,
    streakReward,
  });
});
