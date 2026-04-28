// Supabase service-role клиент для бота. Используется в successful_payment
// handler для записи покупок и начисления replay-кредитов. Никогда не
// пробрасывается в Mini App — service_role обходит RLS.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

// Атомарно: upsert юзера + запись в purchases + инкремент replay_credits.
// Возвращает was_new=false, если этот telegram_payment_id уже обрабатывался.
export async function grantReplayCredit(params: {
  telegramId: number;
  username: string | null;
  firstName: string | null;
  telegramPaymentId: string;
  starsAmount: number;
}): Promise<{ userId: string; wasNew: boolean }> {
  const { data, error } = await getSupabase().rpc('grant_replay_credit', {
    p_telegram_id: params.telegramId,
    p_username: params.username,
    p_first_name: params.firstName,
    p_telegram_payment_id: params.telegramPaymentId,
    p_stars_amount: params.starsAmount,
  });

  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('grant_replay_credit returned no row');
  }
  const row = data[0] as { user_id: string; was_new: boolean };
  return { userId: row.user_id, wasNew: row.was_new };
}

// Атомарно: upsert юзера + запись в purchases + idempotent insert в user_themes.
// Возвращает was_new=false, если этот telegram_payment_id уже обрабатывался.
export async function grantTheme(params: {
  telegramId: number;
  username: string | null;
  firstName: string | null;
  themeId: string;
  telegramPaymentId: string;
  starsAmount: number;
}): Promise<{ userId: string; wasNew: boolean }> {
  const { data, error } = await getSupabase().rpc('grant_theme', {
    p_telegram_id: params.telegramId,
    p_username: params.username,
    p_first_name: params.firstName,
    p_theme_id: params.themeId,
    p_telegram_payment_id: params.telegramPaymentId,
    p_stars_amount: params.starsAmount,
  });

  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('grant_theme returned no row');
  }
  const row = data[0] as { user_id: string; was_new: boolean };
  return { userId: row.user_id, wasNew: row.was_new };
}
