// record-referral: записывает реф-атрибуцию после первого открытия Mini App
// по deep-link `t.me/word_royale_bot/play?startapp=ref_<referrer_telegram_id>`.
//
// Контракт:
//   POST { initData, startParam? } → JSON
//   - initData проверяется HMAC от bot_token (как и в submit-score).
//   - startParam опционален: если не пришёл из тела, берём из проверенного
//     initData (Telegram кладёт его туда как `start_param`).
//   - Атрибуция фиксируется ровно один раз — PK (referrer_id, referred_id)
//     гарантирует это на уровне БД, повторные вызовы — идемпотентны.
//
// Гарантии:
//   - self-referral отсекается (нельзя пригласить самого себя).
//   - referrer должен уже существовать в users (защита от спам-атрибуции
//     к несуществующим/выдуманным аккаунтам).
//   - не-реф-открытия (ссылка без startapp= или с чужим параметром) не
//     возвращают ошибку — функция тихо отвечает recorded=false с reason.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { verifyInitData } from '../_shared/verify-init-data.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RecordReferralBody {
  initData: string;
  startParam?: string;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isBody(value: unknown): value is RecordReferralBody {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.initData === 'string' &&
    (v.startParam === undefined || typeof v.startParam === 'string')
  );
}

const REFERRAL_PREFIX = 'ref_';

function parseReferrerTelegramId(raw: string | null | undefined): number | null {
  if (!raw || !raw.startsWith(REFERRAL_PREFIX)) return null;
  const rest = raw.slice(REFERRAL_PREFIX.length);
  if (!/^\d{1,15}$/.test(rest)) return null;
  const id = Number(rest);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return id;
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

  const rawStartParam = body.startParam ?? verified.startParam ?? null;
  const referrerTgId = parseReferrerTelegramId(rawStartParam);
  if (referrerTgId == null) {
    return jsonResponse(200, { ok: true, recorded: false, reason: 'no_referral' });
  }

  const me = verified.user;
  if (me.id === referrerTgId) {
    return jsonResponse(200, { ok: true, recorded: false, reason: 'self_referral' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Сразу аппертим текущего юзера — referral может быть зафиксирован раньше
  // первой сыгранной партии. Это даёт точную атрибуцию даже если игрок зашёл
  // по ссылке, но не доиграл.
  const { data: referredRow, error: referredErr } = await supabase
    .from('users')
    .upsert(
      {
        telegram_id: me.id,
        username: me.username ?? null,
        first_name: me.first_name ?? null,
        photo_url: me.photo_url ?? null,
        last_active_at: new Date().toISOString(),
      },
      { onConflict: 'telegram_id', ignoreDuplicates: false },
    )
    .select('id')
    .single();
  if (referredErr || !referredRow) {
    return jsonResponse(500, {
      ok: false,
      error: 'user_upsert_failed',
      detail: referredErr?.message,
    });
  }

  // Referrer должен уже существовать. Не апсертим его ради защиты от
  // фейковых атрибуций к выдуманным telegram_id.
  const { data: referrerRow, error: referrerErr } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', referrerTgId)
    .maybeSingle();
  if (referrerErr) {
    return jsonResponse(500, {
      ok: false,
      error: 'referrer_lookup_failed',
      detail: referrerErr.message,
    });
  }
  if (!referrerRow) {
    return jsonResponse(200, { ok: true, recorded: false, reason: 'referrer_not_found' });
  }

  // PK (referrer_id, referred_id) делает повторы no-op.
  const { error: insErr } = await supabase
    .from('referrals')
    .upsert(
      { referrer_id: referrerRow.id, referred_id: referredRow.id },
      { onConflict: 'referrer_id,referred_id', ignoreDuplicates: true },
    );
  if (insErr) {
    return jsonResponse(500, {
      ok: false,
      error: 'referral_insert_failed',
      detail: insErr.message,
    });
  }

  return jsonResponse(200, { ok: true, recorded: true });
});
