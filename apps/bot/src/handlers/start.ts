// Обработчик команды /start. Приветствует юзера и даёт кнопку Mini App.
// Реф-атрибуция через `?start=ref_<id>` сейчас не нужна — реф-ссылки используют
// `startapp=ref_<id>` и открывают Mini App напрямую, минуя бота. Если в будущем
// решим поддерживать классические `t.me/<bot>?start=ref_<id>`, парсить параметр
// надо здесь из `ctx.match`.

import type { Bot } from 'grammy';

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
