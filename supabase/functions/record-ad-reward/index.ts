// record-ad-reward: дневной счётчик rewarded ads с лимитом.
//
// Контракт:
//   POST { initData } → JSON {
//     ok: true,
//     allowed: boolean,        // получил ли юзер бонус (false если лимит исчерпан)
//     watchedToday: number,    // счётчик после операции
//     maxPerDay: number,       // дневной лимит
//   }
//
// Используется фронтом ПОСЛЕ того, как Monetag SDK подтвердил успешный показ
// rewarded-ad. Только если allowed=true — клиент применяет бонус (например,
// +30 сек к таймеру).
//
// Аутентификация — initData HMAC, как в submit-score.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { verifyInitData } from '../_shared/verify-init-data.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_ADS_PER_DAY = 3;

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

  const tg = verified.user;
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .upsert(
      {
        telegram_id: tg.id,
        username: tg.username ?? null,
        first_name: tg.first_name ?? null,
        photo_url: tg.photo_url ?? null,
        last_active_at: new Date().toISOString(),
      },
      { onConflict: 'telegram_id', ignoreDuplicates: false },
    )
    .select('id')
    .single();
  if (userErr || !userRow) {
    return jsonResponse(500, {
      ok: false,
      error: 'user_upsert_failed',
      detail: userErr?.message,
    });
  }

  const { data: rpcData, error: rpcErr } = await supabase.rpc('record_ad_watch', {
    p_user_id: userRow.id,
    p_max_per_day: MAX_ADS_PER_DAY,
  });
  if (rpcErr) {
    return jsonResponse(500, {
      ok: false,
      error: 'record_ad_watch_failed',
      detail: rpcErr.message,
    });
  }
  const row = Array.isArray(rpcData) && rpcData.length > 0 ? rpcData[0] : null;
  if (!row || typeof row !== 'object') {
    return jsonResponse(500, { ok: false, error: 'record_ad_watch_failed', detail: 'no row' });
  }
  const result = row as {
    allowed: boolean;
    watched_today: number;
    max_per_day: number;
  };

  return jsonResponse(200, {
    ok: true,
    allowed: result.allowed,
    watchedToday: result.watched_today,
    maxPerDay: result.max_per_day,
  });
});
