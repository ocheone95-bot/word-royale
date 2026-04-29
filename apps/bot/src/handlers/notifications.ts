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

const NOT_REGISTERED =
  "Play at least once first — that's when we create your profile. Then come back and run /notifications_off if you don't want reminders.";

export function registerNotificationsHandlers(bot: Bot): void {
  bot.command('notifications_off', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    let updated = false;
    try {
      updated = await setNotificationsEnabled({
        telegramId: userId,
        enabled: false,
      });
    } catch (e) {
      console.error('notifications_off failed', e);
      await ctx.reply('Could not save your preference. Please try again later.');
      return;
    }
    if (!updated) {
      await ctx.reply(NOT_REGISTERED);
      return;
    }
    posthog.capture({
      distinctId: String(userId),
      event: 'notifications_toggled',
      properties: { enabled: false },
    });
    await ctx.reply(
      [
        'Daily reminders turned off.',
        '',
        'Run /notifications_on to bring them back when you want a nudge.',
      ].join('\n'),
    );
  });

  bot.command('notifications_on', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    let updated = false;
    try {
      updated = await setNotificationsEnabled({
        telegramId: userId,
        enabled: true,
      });
    } catch (e) {
      console.error('notifications_on failed', e);
      await ctx.reply('Could not save your preference. Please try again later.');
      return;
    }
    if (!updated) {
      await ctx.reply(NOT_REGISTERED);
      return;
    }
    posthog.capture({
      distinctId: String(userId),
      event: 'notifications_toggled',
      properties: { enabled: true },
    });
    await ctx.reply(
      'Daily reminders are on. We will ping you at 09:00 your local time on days you have not played yet.',
    );
  });
}
