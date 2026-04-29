// me-stats: агрегаты по всем играм юзера для экрана профиля.
//
// Контракт:
//   POST { initData } → JSON {
//     ok: true,
//     bestScore: number,         // max(score) среди всех сессий
//     totalGames: number,        // count(*)
//     daysPlayed: number,        // distinct daily_seed (включая replay-сессии)
//     currentStreak: number,     // users.current_streak (single source of truth)
//     bestStreak: number,        // users.best_streak (лучшая серия за всё время)
//     totalWordsFound: number,   // sum(array_length(words_found, 1))
//     longestWord: string | null // самое длинное найденное слово
//   }
//
// Используется MeScreen — отдельным запросом после today-status, чтобы
// today-status оставался лёгким (он зовётся почти на каждом экране).
//
// Аутентификация — initData HMAC, как везде. verify_jwt = false.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { verifyInitData } from '../_shared/verify-init-data.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Body {
  initData: string;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isBody(value: unknown): value is Body {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.initData === 'string';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'method_not_allowed' });
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!botToken || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { ok: false, error: 'server_misconfigured' });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid_json' });
  }
  if (!isBody(body)) {
    return jsonResponse(400, { ok: false, error: 'invalid_body' });
  }

  const verified = await verifyInitData(body.initData, botToken);
  if (!verified) {
    return jsonResponse(401, { ok: false, error: 'invalid_init_data' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: meRow, error: meErr } = await supabase
    .from('users')
    .select('id, current_streak, best_streak')
    .eq('telegram_id', verified.user.id)
    .maybeSingle();
  if (meErr) {
    return jsonResponse(500, {
      ok: false,
      error: 'user_lookup_failed',
      detail: meErr.message,
    });
  }

  // Юзер не появлялся → нулевые статы. На MeScreen это значит «новичок».
  if (!meRow) {
    return jsonResponse(200, {
      ok: true,
      bestScore: 0,
      totalGames: 0,
      daysPlayed: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalWordsFound: 0,
      longestWord: null,
    });
  }

  // Тащим все сессии юзера. Один игрок ≈ 1 запись в день, за год накопится
  // ~365 строк — окей для агрегата в JS. Если когда-нибудь упрёмся —
  // переедем в SQL view с GROUP BY user_id.
  const { data: sessions, error: sessionsErr } = await supabase
    .from('game_sessions')
    .select('score, words_found, daily_seed')
    .eq('user_id', meRow.id);
  if (sessionsErr) {
    return jsonResponse(500, {
      ok: false,
      error: 'sessions_lookup_failed',
      detail: sessionsErr.message,
    });
  }

  const rows = sessions ?? [];
  let bestScore = 0;
  let totalWordsFound = 0;
  let longestWord: string | null = null;
  const seedSet = new Set<string>();

  for (const row of rows) {
    const score = (row.score as number) ?? 0;
    if (score > bestScore) bestScore = score;
    const words = (row.words_found as string[] | null) ?? [];
    totalWordsFound += words.length;
    for (const w of words) {
      if (!longestWord || w.length > longestWord.length) longestWord = w;
    }
    if (typeof row.daily_seed === 'string') seedSet.add(row.daily_seed);
  }

  return jsonResponse(200, {
    ok: true,
    bestScore,
    totalGames: rows.length,
    daysPlayed: seedSet.size,
    currentStreak: (meRow.current_streak as number) ?? 0,
    bestStreak: (meRow.best_streak as number) ?? 0,
    totalWordsFound,
    longestWord,
  });
});
