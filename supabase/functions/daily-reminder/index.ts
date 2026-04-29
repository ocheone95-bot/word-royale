// daily-reminder: один тик кронной задачи. Триггерится из Vercel Cron Job
// (apps/bot/api/cron/reminder.ts) раз в час, дёргает RPC list_users_for_reminder
// и шлёт напоминания через Telegram Bot API.
//
// Аутентификация: Authorization: Bearer ${CRON_SECRET}. Vercel автоматически
// шлёт этот header для cron-jobs, если CRON_SECRET задан в env (см. docs).
//
// Идемпотентность: list_users_for_reminder фильтрует по last_reminder_sent_date,
// поэтому повторный вызов в тот же час ничего не отправит. Если бот упал между
// sendMessage и mark_reminder_sent — юзер получит дубль на следующий час
// (минорная плата за надёжность).

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ReminderUser {
  id: string;
  telegram_id: number;
  current_streak: number;
  local_today: string;
  language_code: string | null;
}

const MINI_APP_URL =
  Deno.env.get('MINI_APP_URL') ?? 'https://word-royale-miniapp.vercel.app/';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type Lang = 'en' | 'ru';

function resolveLang(input: string | null): Lang {
  if (input === 'ru') return 'ru';
  return 'en';
}

function buildMessage(streak: number, lang: Lang): string {
  // Без эмоджи (PM-фидбек, сессия 12). Pixel-spade ♠ как в StreakChip.
  if (lang === 'ru') {
    if (streak >= 1) {
      return [
        `♠ ${streak} ${pluralRuDays(streak)} подряд — не теряй серию`,
        '',
        'Сегодняшний паззл Word Royale готов. 90 секунд — и серия продлится.',
      ].join('\n');
    }
    return [
      '♠ Сегодняшний паззл Word Royale готов',
      '',
      'Те же 7 букв для всего мира. 90 секунд. Нажми кнопку ниже.',
    ].join('\n');
  }
  if (streak >= 1) {
    return [
      `♠ ${streak} day streak — keep it alive`,
      '',
      "Today's Word Royale puzzle is ready. Play 90 seconds to extend your streak.",
    ].join('\n');
  }
  return [
    "♠ Today's Word Royale puzzle is ready",
    '',
    'Same 7 letters for everyone. 90 seconds. Tap below to play.',
  ].join('\n');
}

function pluralRuDays(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'дня';
  return 'дней';
}

function buildPlayButton(lang: Lang): string {
  return lang === 'ru' ? '▶️ Играть' : '▶️ Play now';
}

async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  buttonText: string,
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
            [{ text: buttonText, web_app: { url: MINI_APP_URL } }],
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

  const { data, error } = await supabase.rpc('list_users_for_reminder');
  if (error) {
    return jsonResponse(500, {
      ok: false,
      error: 'list_failed',
      detail: error.message,
    });
  }
  const users = (data ?? []) as ReminderUser[];

  let sent = 0;
  let failed = 0;
  // Telegram rate-limit для broadcast — около 30 msg/sec. На MVP-объёмах
  // (десятки-сотни юзеров одновременно) не упрёмся, но ставим лёгкую задержку,
  // чтобы не словить 429 при росте.
  for (const user of users) {
    const lang = resolveLang(user.language_code);
    const text = buildMessage(user.current_streak ?? 0, lang);
    const result = await sendTelegramMessage(
      botToken,
      user.telegram_id,
      text,
      buildPlayButton(lang),
    );
    if (result.ok) {
      sent += 1;
      const { error: markErr } = await supabase.rpc('mark_reminder_sent', {
        p_user_id: user.id,
        p_local_today: user.local_today,
      });
      if (markErr) {
        // Не фатально — на следующем часе юзер просто получит дубль.
        console.warn('mark_reminder_sent failed', user.id, markErr.message);
      }
    } else {
      failed += 1;
      // 403 (forbidden: bot was blocked) — самая частая ошибка.
      // Если юзер заблокировал бота, имеет смысл выключить notifications,
      // чтобы не дёргать Telegram попусту.
      if (result.status === 403) {
        await supabase.rpc('set_notifications_enabled', {
          p_telegram_id: user.telegram_id,
          p_enabled: false,
        });
      }
      console.warn(
        'reminder send failed',
        user.telegram_id,
        result.status ?? '-',
        result.description ?? '-',
      );
    }
    // Минимальная задержка между отправками (33 ms ≈ 30/sec).
    await new Promise((r) => setTimeout(r, 35));
  }

  return jsonResponse(200, {
    ok: true,
    candidates: users.length,
    sent,
    failed,
  });
});
