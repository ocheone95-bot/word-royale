// friends-leaderboard: топ среди реферальных «друзей» текущего юзера на сегодня.
//
// Контракт:
//   POST { initData, dailySeed } → JSON { ok: true, entries: LeaderboardEntry[] }
//
// «Друг» = любой юзер, с которым у меня есть запись в `referrals` в любую
// сторону (я пригласил его / он пригласил меня). В MVP не требуем взаимности —
// это даст наибольший охват для первых дней, когда сеть ещё разрежена.
//
// Архитектурно симметрично submit-score: запрос только через initData (HMAC),
// не через RLS. Любая другая «личная» выборка в проекте должна идти тем же
// путём, чтобы не размазывать аутентификацию по двум разным механизмам.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { verifyInitData } from '../_shared/verify-init-data.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface FriendsBody {
  initData: string;
  dailySeed: string;
}

interface LeaderboardEntry {
  telegramId: number;
  username: string | null;
  firstName: string | null;
  photoUrl: string | null;
  score: number;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isBody(value: unknown): value is FriendsBody {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.initData === 'string' && typeof v.dailySeed === 'string';
}

// Простая sanity-проверка формата YYYY-MM-DD; БД всё равно скастит к date.
const DAILY_SEED_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    .select('id')
    .eq('telegram_id', verified.user.id)
    .maybeSingle();
  if (meErr) {
    return jsonResponse(500, {
      ok: false,
      error: 'user_lookup_failed',
      detail: meErr.message,
    });
  }
  // Юзер не играл и не открывал по ref-ссылке — друзей быть не может.
  if (!meRow) {
    return jsonResponse(200, { ok: true, entries: [] });
  }

  // Все рефералы, в которых я участвую — собираем UUID противоположной стороны.
  const { data: refRows, error: refErr } = await supabase
    .from('referrals')
    .select('referrer_id, referred_id')
    .or(`referrer_id.eq.${meRow.id},referred_id.eq.${meRow.id}`);
  if (refErr) {
    return jsonResponse(500, {
      ok: false,
      error: 'referrals_lookup_failed',
      detail: refErr.message,
    });
  }
  const friendIds = new Set<string>();
  for (const r of refRows ?? []) {
    const a = (r as { referrer_id: string; referred_id: string }).referrer_id;
    const b = (r as { referrer_id: string; referred_id: string }).referred_id;
    if (a !== meRow.id) friendIds.add(a);
    if (b !== meRow.id) friendIds.add(b);
  }
  if (friendIds.size === 0) {
    return jsonResponse(200, { ok: true, entries: [] });
  }

  // Лучший скор каждого друга на этот seed. Берём с запасом: одна сессия
  // на юзера в день у нас не enforced (придёт со Stars в неделе 4),
  // дедуп делаем сами по telegram_id, как в публичном топ-100.
  const { data: rows, error: sessErr } = await supabase
    .from('game_sessions')
    .select('score, users!inner(telegram_id, username, first_name, photo_url)')
    .eq('daily_seed', body.dailySeed)
    .in('user_id', Array.from(friendIds))
    .order('score', { ascending: false })
    .limit(friendIds.size * 3);
  if (sessErr) {
    return jsonResponse(500, {
      ok: false,
      error: 'sessions_query_failed',
      detail: sessErr.message,
    });
  }

  type Row = {
    score: number;
    users: {
      telegram_id: number;
      username: string | null;
      first_name: string | null;
      photo_url: string | null;
    } | null;
  };

  const bestByUser = new Map<number, LeaderboardEntry>();
  for (const raw of (rows ?? []) as unknown as Row[]) {
    if (!raw.users) continue;
    const existing = bestByUser.get(raw.users.telegram_id);
    if (existing && existing.score >= raw.score) continue;
    bestByUser.set(raw.users.telegram_id, {
      telegramId: raw.users.telegram_id,
      username: raw.users.username,
      firstName: raw.users.first_name,
      photoUrl: raw.users.photo_url,
      score: raw.score,
    });
  }

  const entries = Array.from(bestByUser.values()).sort((a, b) => b.score - a.score);
  return jsonResponse(200, { ok: true, entries });
});
