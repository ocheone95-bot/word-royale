// Vercel Serverless entry — точка входа для Telegram webhook.
// Telegram POST'ит сюда апдейты, grammY превращает их в вызовы хендлеров.
// `secretToken` сверяет заголовок `X-Telegram-Bot-Api-Secret-Token` с тем, что
// мы зарегистрировали через `setWebhook` — защита от чужих POST'ов на endpoint.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { webhookCallback } from 'grammy';
import { createBot } from '../src/bot.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN env var is required');
}

const bot = createBot(token);

const handle = webhookCallback(bot, 'http', {
  secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
});

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handle(req, res);
}
