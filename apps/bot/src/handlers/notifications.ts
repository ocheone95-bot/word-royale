// Команды управления daily-reminder push'ами.
//   /notifications_off — отключить (set notifications_enabled=false)
//   /notifications_on — включить обратно
//
// Юзер должен сначала играть хотя бы один раз — бот не создаёт запись в
// public.users, это делает Edge Function submit-score. Если запись отсутствует
// — отвечаем мягким сообщением «play first to subscribe».

import type { Bot } from 'grammy';
import { setNotificationsEnabled } from '../supabase.js';
import { posthog } from '../posthog.js';
import { bt, detectBotLang } from '../i18n.js';

export function registerNotificationsHandlers(bot: Bot): void {
  bot.command('notifications_off', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const lang = detectBotLang(ctx.from?.language_code ?? null);
    let updated = false;
    try {
      updated = await setNotificationsEnabled({
        telegramId: userId,
        enabled: false,
      });
    } catch (e) {
      console.error('notifications_off failed', e);
      await ctx.reply(bt('could_not_save', lang));
      return;
    }
    if (!updated) {
      await ctx.reply(bt('not_registered', lang));
      return;
    }
    posthog.capture({
      distinctId: String(userId),
      event: 'notifications_toggled',
      properties: { enabled: false },
    });
    await ctx.reply(bt('notifications_off_confirmed', lang));
  });

  bot.command('notifications_on', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const lang = detectBotLang(ctx.from?.language_code ?? null);
    let updated = false;
    try {
      updated = await setNotificationsEnabled({
        telegramId: userId,
        enabled: true,
      });
    } catch (e) {
      console.error('notifications_on failed', e);
      await ctx.reply(bt('could_not_save', lang));
      return;
    }
    if (!updated) {
      await ctx.reply(bt('not_registered', lang));
      return;
    }
    posthog.capture({
      distinctId: String(userId),
      event: 'notifications_toggled',
      properties: { enabled: true },
    });
    await ctx.reply(bt('notifications_on_confirmed', lang));
  });
}
