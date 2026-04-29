// today-status: статус юзера на сегодняшний challenge.
//
// Контракт:
//   POST { initData, dailySeed } → JSON {
//     ok: true,
//     playedToday: boolean,         // есть ли non-replay сессия на сегодня
//     replayCredits: number,        // купленных и неиспользованных
//     freeGameAvailable: boolean,   // !playedToday или Pro active — удобство для UI
//     themes: string[],             // theme_id-шки купленных тем (для Pro — все)
//     doubleScoreActive: boolean,   // буст ×2 куплен на сегодня и не потрачен
//     proActive: boolean,           // активна ли Word Pro подписка
//     proExpiresAt: string | null,  // ISO-таймстамп истечения Pro (null если нет)
//     adsWatchedToday: number,      // сколько rewarded ads уже смотрел сегодня
//     adsMaxPerDay: number,         // дневной лимит (анти-чит)
//     currentStreak: number,        // текущая серия дней подряд (UTC)
//     bestStreak: number,           // лучшая серия за всё время
//     proTrialActive: boolean,      // free trial активен сейчас (выдан < 24h назад и proActive)
//     proTrialUsed: boolean,        // юзер когда-либо получал trial (для UI «trial expired»)
//     weekStart: string,            // понедельник текущей недели в UTC (YYYY-MM-DD)
//     weekEnd: string,              // следующий понедельник (exclusive)
//     weeklyRank: number | null,    // позиция в недельном турнире (null если не играл)
//     weeklyTotalScore: number | null, // сумма лучших скоров по дням недели
//   }
//
// Используется HomeScreen / ResultScreen / ShopScreen — для подсветки купленных
// тем, оставшихся replay-токенов и состояния «Buy replay» vs «Play replay».
//
// Аутентификация — initData HMAC, как в submit-score / friends-leaderboard.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { verifyInitData } from '../_shared/verify-init-data.ts';
import { ADS_MAX_PER_DAY } from '../_shared/limits.ts';

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

function addDaysIso(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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
    .select(
      'id, replay_credits, double_score_date, ads_watched_date, ads_watched_count, current_streak, best_streak, pro_trial_granted_at',
    )
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
    const { data: weekStartData } = await supabase.rpc('current_week_start');
    const ws = String(weekStartData ?? '');
    const we = ws ? addDaysIso(ws, 7) : '';
    return jsonResponse(200, {
      ok: true,
      playedToday: false,
      replayCredits: 0,
      freeGameAvailable: true,
      themes: [],
      doubleScoreActive: false,
      proActive: false,
      proExpiresAt: null,
      adsWatchedToday: 0,
      adsMaxPerDay: ADS_MAX_PER_DAY,
      currentStreak: 0,
      bestStreak: 0,
      proTrialActive: false,
      proTrialUsed: false,
      weekStart: ws,
      weekEnd: we,
      weeklyRank: null,
      weeklyTotalScore: null,
    });
  }

  const [
    { count, error: countErr },
    { data: themesRows, error: themesErr },
    { data: proRow, error: proErr },
    { data: weeklyRows, error: weeklyErr },
    { data: weekStartData, error: weekStartErr },
  ] = await Promise.all([
    supabase
      .from('game_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', meRow.id)
      .eq('daily_seed', body.dailySeed)
      .eq('was_replay', false),
    supabase.from('user_themes').select('theme_id').eq('user_id', meRow.id),
    supabase
      .from('subscriptions')
      .select('expires_at, status')
      .eq('user_id', meRow.id)
      .eq('tier', 'pro')
      .maybeSingle(),
    supabase.rpc('get_user_weekly_rank', { p_user_id: meRow.id }),
    supabase.rpc('current_week_start'),
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
  if (proErr) {
    return jsonResponse(500, {
      ok: false,
      error: 'subscription_lookup_failed',
      detail: proErr.message,
    });
  }
  if (weeklyErr) {
    return jsonResponse(500, {
      ok: false,
      error: 'weekly_rank_lookup_failed',
      detail: weeklyErr.message,
    });
  }
  if (weekStartErr) {
    return jsonResponse(500, {
      ok: false,
      error: 'week_start_lookup_failed',
      detail: weekStartErr.message,
    });
  }

  const playedToday = (count ?? 0) > 0;
  const ownedThemes = (themesRows ?? []).map((r) => r.theme_id as string);
  const doubleScoreActive =
    typeof meRow.double_score_date === 'string' &&
    meRow.double_score_date === body.dailySeed;

  const proExpiresAt =
    proRow && typeof proRow.expires_at === 'string'
      ? proRow.expires_at
      : null;
  const proActive =
    !!proRow &&
    proRow.status === 'active' &&
    proExpiresAt !== null &&
    new Date(proExpiresAt).getTime() > Date.now();

  // Pro даёт доступ ко всем темам без отдельной покупки. UI рисует их как owned.
  const ALL_THEMES = ['neon', 'retro', 'sakura', 'cyberpunk'];
  const themes = proActive
    ? Array.from(new Set([...ownedThemes, ...ALL_THEMES]))
    : ownedThemes;

  const adsWatchedToday =
    typeof meRow.ads_watched_date === 'string' &&
    meRow.ads_watched_date === body.dailySeed
      ? (meRow.ads_watched_count as number) ?? 0
      : 0;

  // Trial active = pro_trial_granted_at был в последние 24h И сейчас Pro
  // активна. Если юзер за trial успел купить paid Pro — после 24h flag
  // автоматически потушится (UI переключится с «Trial · 5h left» на «Pro»).
  const trialGrantedAt =
    typeof meRow.pro_trial_granted_at === 'string'
      ? meRow.pro_trial_granted_at
      : null;
  const proTrialUsed = trialGrantedAt !== null;
  const proTrialActive =
    proActive &&
    trialGrantedAt !== null &&
    new Date(trialGrantedAt).getTime() + 24 * 60 * 60 * 1000 > Date.now();

  type WeeklyRow = { rank: number; total_score: number; days_played: number };
  const weeklyArr = (weeklyRows ?? []) as WeeklyRow[];
  const weeklyRow = weeklyArr.length > 0 ? weeklyArr[0] : null;
  const weekStart = String(weekStartData ?? '');
  const weekEnd = weekStart ? addDaysIso(weekStart, 7) : '';

  return jsonResponse(200, {
    ok: true,
    playedToday,
    replayCredits: meRow.replay_credits as number,
    // Pro обходит rate-limit: «доступна бесплатная игра» = !играл OR Pro active.
    freeGameAvailable: !playedToday || proActive,
    themes,
    doubleScoreActive,
    proActive,
    proExpiresAt,
    adsWatchedToday,
    adsMaxPerDay: ADS_MAX_PER_DAY,
    currentStreak: (meRow.current_streak as number) ?? 0,
    bestStreak: (meRow.best_streak as number) ?? 0,
    proTrialActive,
    proTrialUsed,
    weekStart,
    weekEnd,
    weeklyRank: weeklyRow ? weeklyRow.rank : null,
    weeklyTotalScore: weeklyRow ? weeklyRow.total_score : null,
  });
});
