// Фабрика grammY-бота. Регистрирует все хендлеры и возвращает готовый экземпляр.
// Используется как из webhook-входа на Vercel, так и из локальных скриптов.

import { Bot } from 'grammy';
import { registerStartHandler } from './handlers/start.js';
import { registerBuyHandlers } from './handlers/buy.js';

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  registerStartHandler(bot);
  registerBuyHandlers(bot);

  return bot;
}
