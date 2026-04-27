// Обработчик команды /start. Без payload — приветствует юзера и даёт кнопку
// Mini App. С payload `buy_replay` (deep-link из Mini App «Buy replay») —
// сразу шлёт Stars-инвойс, минуя приветствие.
//
// Реф-атрибуция через `?start=ref_<id>` сейчас не нужна — реф-ссылки используют
// `startapp=ref_<id>` и открывают Mini App напрямую, минуя бота.

import type { Bot } from 'grammy';
import { sendReplayInvoice } from './buy.js';

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
    if (typeof payload === 'string' && payload === 'buy_replay') {
      await sendReplayInvoice(ctx);
      return;
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
