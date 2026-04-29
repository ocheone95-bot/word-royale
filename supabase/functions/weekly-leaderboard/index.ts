// weekly-leaderboard: топ-100 за неделю + позиция текущего юзера.
//
// Контракт:
//   POST { initData, week: 'current' | 'previous' } → JSON {
//     ok: true,
//     weekStart: 'YYYY-MM-DD',
//     weekEnd: 'YYYY-MM-DD',         // exclusive — следующий понедельник
//     prizesDistributed: boolean,    // для previous week, чтобы UI знал «уже раздали»
//     entries: WeeklyEntry[],        // топ-100 (включая self если он там)
//     selfRank: number | null,       // позиция текущего юзера (null если не играл)
//     selfTotalScore: number | null,
//   }
//
// Использует RPC get_weekly_leaderboard, который сам считает топ-N + добивает
// строкой текущего юзера если он не в топе. Веб не должен ходить в game_sessions
// напрямую — все weekly-агрегаты только через эту функцию.
//
// Аутентификация — initData HMAC.

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
  week?: 'current' | 'previous';
}

interface WeeklyEntry {
  rank: number;
  telegramId: number;
  username: string | null;
  firstName: string | null;
  photoUrl: string | null;
  totalScore: number;
  daysPlayed: number;
  isSelf: boolean;
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
  if (typeof v.initData !== 'string') return false;
  if (v.week !== undefined && v.week !== 'current' && v.week !== 'previous') {
    return false;
  }
  return true;
}

function addDays(dateStr: string, days: number): string {
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

  const requested = body.week ?? 'current';
  const rpcName =
    requested === 'previous' ? 'previous_week_start' : 'current_week_start';

  const { data: weekStartData, error: weekErr } = await supabase.rpc(rpcName);
  if (weekErr || !weekStartData) {
    return jsonResponse(500, {
      ok: false,
      error: 'week_resolve_failed',
      detail: weekErr?.message ?? null,
    });
  }
  const weekStart = String(weekStartData);
  const weekEnd = addDays(weekStart, 7);

  const { data: rows, error: leadErr } = await supabase.rpc(
    'get_weekly_leaderboard',
    {
      p_week_start: weekStart,
      p_user_id: meRow?.id ?? null,
      p_limit: 100,
    },
  );
  if (leadErr) {
    return jsonResponse(500, {
      ok: false,
      error: 'leaderboard_query_failed',
      detail: leadErr.message,
    });
  }

  type Row = {
    rank: number;
    user_id: string;
    telegram_id: number;
    first_name: string | null;
    username: string | null;
    photo_url: string | null;
    total_score: number;
    days_played: number;
    is_self: boolean;
  };

  const all = (rows ?? []) as Row[];
  const top = all.filter((r) => r.rank <= 100);
  const selfRow = all.find((r) => r.is_self) ?? null;

  const entries: WeeklyEntry[] = top.map((r) => ({
    rank: r.rank,
    telegramId: r.telegram_id,
    username: r.username,
    firstName: r.first_name,
    photoUrl: r.photo_url,
    totalScore: r.total_score,
    daysPlayed: r.days_played,
    isSelf: r.is_self,
  }));

  let prizesDistributed = false;
  if (requested === 'previous') {
    const { data: tournRow } = await supabase
      .from('weekly_tournaments')
      .select('prizes_distributed')
      .eq('week_start', weekStart)
      .maybeSingle();
    prizesDistributed = !!tournRow?.prizes_distributed;
  }

  return jsonResponse(200, {
    ok: true,
    weekStart,
    weekEnd,
    prizesDistributed,
    entries,
    selfRank: selfRow ? selfRow.rank : null,
    selfTotalScore: selfRow ? selfRow.total_score : null,
  });
});
