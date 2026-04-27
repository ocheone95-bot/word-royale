// Команды /buy_* шлют Telegram Stars-инвойс через sendInvoice.
// payload содержит productId и telegramUserId — Telegram возвращает его
// в pre_checkout_query и successful_payment, по нему мы понимаем кто и что купил.

import type { Bot, Context } from 'grammy';
import { PRODUCTS, isProductId, type ProductId } from '../products.js';

// Формат: <productId>:<telegramUserId>:<nonce>
// nonce защищает от случайного дубля одного и того же payload в БД, если Telegram
// перепошлёт webhook (мы используем telegram_payment_charge_id как PK, так что
// двойного начисления не случится, но nonce удобен для логов).
export function buildInvoicePayload(productId: ProductId, telegramUserId: number): string {
  const nonce = Math.random().toString(36).slice(2, 10);
  return `${productId}:${telegramUserId}:${nonce}`;
}

export interface ParsedPayload {
  productId: ProductId;
  telegramUserId: number;
}

export function parseInvoicePayload(payload: string): ParsedPayload | null {
  const parts = payload.split(':');
  if (parts.length !== 3) return null;
  const [productIdRaw, telegramUserIdRaw] = parts;
  if (!productIdRaw || !telegramUserIdRaw) return null;
  if (!isProductId(productIdRaw)) return null;
  const telegramUserId = Number(telegramUserIdRaw);
  if (!Number.isFinite(telegramUserId) || telegramUserId <= 0) return null;
  return { productId: productIdRaw, telegramUserId };
}

// Шлёт invoice для replay-продукта в текущий чат. Используется и из команды
// /buy_replay, и из /start buy_replay (deep-link из Mini App).
export async function sendReplayInvoice(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) {
    await ctx.reply('Could not identify you. Open the bot from your Telegram app.');
    return;
  }

  const product = PRODUCTS.replay;

  await ctx.replyWithInvoice(
    product.title,
    product.description,
    buildInvoicePayload(product.id, userId),
    'XTR',
    [{ label: product.title, amount: product.starsAmount }],
    // provider_token для Stars должен быть пустой строкой
    { provider_token: '' },
  );
}

export function registerBuyHandlers(bot: Bot): void {
  bot.command('buy_replay', sendReplayInvoice);
}
