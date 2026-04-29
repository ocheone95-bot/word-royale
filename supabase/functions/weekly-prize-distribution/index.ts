// weekly-prize-distribution: cron-only функция. Раздаёт призы за прошлую
// календарную неделю и шлёт DM призёрам через Bot API.
//
// Триггерится из GitHub Actions schedule (см. .github/workflows/weekly-prize.yml)
// каждое воскресенье 23:55 UTC. Идемпотентно: повторный вызов после успешной
// раздачи вернёт awarded=false без побочек (защита через
// weekly_tournaments.prizes_distributed).
//
// Аутентификация: Authorization: Bearer ${CRON_SECRET}.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MINI_APP_URL =
  Deno.env.get('MINI_APP_URL') ?? 'https://word-royale-miniapp.vercel.app/';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildPrizeMessage(rank: number, prizeType: string): string {
  // Без эмоджи — pixel-spade ♠ + ♛ как в проекте.
  if (prizeType === 'pro_30d') {
    return [
      `♛ Top-${rank} this week`,
      '',
      'Prize: 30 days of Word Pro — unlimited replays + all themes.',
      'Already added to your account.',
    ].join('\n');
  }
  if (prizeType === 'replay_credits_5') {
    return [
      `♠ Top-${rank} this week`,
      '',
      'Prize: 5 free replays — added to your account.',
      'New tournament starts now. Defend your rank.',
    ].join('\n');
  }
  return `Top-${rank} this week — prize granted.`;
}

async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
): Promise<{ ok: boolean; status?: number; description?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: {
          inline_keyboard: [
            [{ text: '▶️ Play now', web_app: { url: MINI_APP_URL } }],
          ],
        },
      }),
    });
  } catch (e) {
    return { ok: false, description: String(e) };
  }
  let json: { ok?: boolean; description?: string } = {};
  try {
    json = (await res.json()) as { ok?: boolean; description?: string };
  } catch {
    // ignore
  }
  if (!res.ok || !json.ok) {
    return {
      ok: false,
      status: res.status,
      description: json.description ?? `http_${res.status}`,
    };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'method_not_allowed' });
  }

  const cronSecret = Deno.env.get('CRON_SECRET');
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!cronSecret || !botToken || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { ok: false, error: 'server_misconfigured' });
  }

  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${cronSecret}`) {
    return jsonResponse(401, { ok: false, error: 'unauthorized' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Резолвим прошлую неделю (понедельник прошлой недели).
  const { data: prevWeekData, error: prevWeekErr } = await supabase.rpc(
    'previous_week_start',
  );
  if (prevWeekErr || !prevWeekData) {
    return jsonResponse(500, {
      ok: false,
      error: 'week_resolve_failed',
      detail: prevWeekErr?.message ?? null,
    });
  }
  const weekStart = String(prevWeekData);

  const { data: awardData, error: awardErr } = await supabase.rpc(
    'award_weekly_prizes',
    { p_week_start: weekStart },
  );
  if (awardErr) {
    return jsonResponse(500, {
      ok: false,
      error: 'award_failed',
      detail: awardErr.message,
    });
  }

  type AwardRow = {
    awarded: boolean;
    top10_count: number;
    top100_count: number;
  };
  const award = ((awardData ?? [])[0] ?? {
    awarded: false,
    top10_count: 0,
    top100_count: 0,
  }) as AwardRow;

  // Уведомляем призёров в любом случае: если awarded=false (повторный запуск),
  // шлём только если ранее не успели — но проще считать что DM шлём только
  // когда awarded=true. Иначе на каждый ручной перезапуск получим дубль.
  let dmSent = 0;
  let dmFailed = 0;
  if (award.awarded) {
    const { data: recipients, error: recErr } = await supabase.rpc(
      'list_weekly_prize_recipients',
      { p_week_start: weekStart },
    );
    if (recErr) {
      return jsonResponse(500, {
        ok: false,
        error: 'recipients_failed',
        detail: recErr.message,
      });
    }
    type Rec = {
      user_id: string;
      telegram_id: number;
      rank: number;
      prize_type: string;
    };
    const list = (recipients ?? []) as Rec[];
    for (const r of list) {
      const text = buildPrizeMessage(r.rank, r.prize_type);
      const result = await sendTelegramMessage(botToken, r.telegram_id, text);
      if (result.ok) {
        dmSent += 1;
      } else {
        dmFailed += 1;
        if (result.status === 403) {
          await supabase.rpc('set_notifications_enabled', {
            p_telegram_id: r.telegram_id,
            p_enabled: false,
          });
        }
        console.warn(
          'prize dm failed',
          r.telegram_id,
          result.status ?? '-',
          result.description ?? '-',
        );
      }
      await new Promise((res2) => setTimeout(res2, 35));
    }
  }

  return jsonResponse(200, {
    ok: true,
    weekStart,
    awarded: award.awarded,
    top10Count: award.top10_count,
    top100Count: award.top100_count,
    dmSent,
    dmFailed,
  });
});
