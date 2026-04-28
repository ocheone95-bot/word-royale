// today-status: статус юзера на сегодняшний challenge.
//
// Контракт:
//   POST { initData, dailySeed } → JSON {
//     ok: true,
//     playedToday: boolean,         // есть ли non-replay сессия на сегодня
//     replayCredits: number,        // купленных и неиспользованных
//     freeGameAvailable: boolean,   // !playedToday — удобство для UI
//     themes: string[],             // theme_id-шки купленных тем
//   }
//
// Используется HomeScreen / ResultScreen / ShopScreen — для подсветки купленных
// тем, оставшихся replay-токенов и состояния «Buy replay» vs «Play replay».
//
// Аутентификация — initData HMAC, как в submit-score / friends-leaderboard.

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
  dailySeed: string;
}

const DAILY_SEED_RE = /^\d{4}-\d{2}-\d{2}$/;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isBody(value: unknown): value is Body {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.initData === 'string' && typeof v.dailySeed === 'string';
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
  if (!DAILY_SEED_RE.test(body.dailySeed)) {
    return jsonResponse(400, { ok: false, error: 'invalid_seed' });
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
    .select('id, replay_credits')
    .eq('telegram_id', verified.user.id)
    .maybeSingle();
  if (meErr) {
    return jsonResponse(500, {
      ok: false,
      error: 'user_lookup_failed',
      detail: meErr.message,
    });
  }

  // Юзер ещё не появлялся — соответственно, ничего не играл, кредитов и тем нет.
  if (!meRow) {
    return jsonResponse(200, {
      ok: true,
      playedToday: false,
      replayCredits: 0,
      freeGameAvailable: true,
      themes: [],
    });
  }

  const [{ count, error: countErr }, { data: themesRows, error: themesErr }] =
    await Promise.all([
      supabase
        .from('game_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', meRow.id)
        .eq('daily_seed', body.dailySeed)
        .eq('was_replay', false),
      supabase.from('user_themes').select('theme_id').eq('user_id', meRow.id),
    ]);
  if (countErr) {
    return jsonResponse(500, {
      ok: false,
      error: 'sessions_count_failed',
      detail: countErr.message,
    });
  }
  if (themesErr) {
    return jsonResponse(500, {
      ok: false,
      error: 'themes_lookup_failed',
      detail: themesErr.message,
    });
  }

  const playedToday = (count ?? 0) > 0;
  const themes = (themesRows ?? []).map((r) => r.theme_id as string);
  return jsonResponse(200, {
    ok: true,
    playedToday,
    replayCredits: meRow.replay_credits as number,
    freeGameAvailable: !playedToday,
    themes,
  });
});
