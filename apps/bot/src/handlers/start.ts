// Обработчик команды /start. Без payload — приветствует юзера и даёт кнопку
// Mini App. С payload `buy_<product>` (deep-link из Mini App «Buy …») сразу
// шлёт Stars-инвойс на этот продукт, минуя приветствие.
//
// Реф-атрибуция через `?start=ref_<id>` сейчас не нужна — реф-ссылки используют
// `startapp=ref_<id>` и открывают Mini App напрямую, минуя бота.

import type { Bot } from 'grammy';
import { sendProductInvoice } from './buy.js';
import { isProductId } from '../products.js';
import { posthog } from '../posthog.js';

const MINI_APP_URL = process.env.MINI_APP_URL ?? 'https://word-royale-miniapp.vercel.app/';

const WELCOME = [
  '🎮 *Word Royale*',
  '',
  'Make as many words as you can from 7 letters in 90 seconds.',
  'Same puzzle for everyone, every day.',
  '',
  'Tap *Play* to start.',
].join('\n');

export function registerStartHandler(bot: Bot): void {
  bot.command('start', async (ctx) => {
    const payload = ctx.match;
    const userId = ctx.from?.id;
    const username = ctx.from?.username ?? null;
    const firstName = ctx.from?.first_name ?? null;

    if (userId) {
      posthog.identify({
        distinctId: String(userId),
        properties: {
          $set: { username, first_name: firstName },
          $set_once: { first_seen_at: new Date().toISOString() },
        },
      });
      posthog.capture({
        distinctId: String(userId),
        event: 'bot_started',
        properties: {
          has_payload: typeof payload === 'string' && payload.length > 0,
          payload_type: typeof payload === 'string' && payload.startsWith('buy_') ? 'buy' : 'none',
        },
      });
    }

    if (typeof payload === 'string' && payload.startsWith('buy_')) {
      const productId = payload.slice('buy_'.length);
      if (isProductId(productId)) {
        await sendProductInvoice(ctx, productId);
        return;
      }
    }

    await ctx.reply(WELCOME, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '▶️ Play', web_app: { url: MINI_APP_URL } }],
        ],
      },
    });
  });
}
