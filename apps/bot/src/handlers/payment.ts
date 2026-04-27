// Stars-платежи. Два хендлера:
//   1. pre_checkout_query — последний шанс отказать перед списанием. Telegram
//      даёт 10 секунд. Если не ответили или ok=false — деньги не списываются.
//   2. successful_payment — деньги уже списаны, Telegram прислал подтверждение.
//      Зачисляем товар атомарной RPC grant_replay_credit. Идемпотентно по
//      telegram_payment_charge_id (если webhook ретрайнется, второй раз товар
//      не зачислится).

import type { Bot } from 'grammy';
import { getProduct } from '../products.js';
import { parseInvoicePayload } from './buy.js';
import { grantReplayCredit } from '../supabase.js';

export function registerPaymentHandlers(bot: Bot): void {
  bot.on('pre_checkout_query', async (ctx) => {
    const q = ctx.preCheckoutQuery;

    const parsed = parseInvoicePayload(q.invoice_payload);
    if (!parsed) {
      await ctx.answerPreCheckoutQuery(false, {
        error_message: 'Invalid order. Please try again.',
      });
      return;
    }

    if (parsed.telegramUserId !== q.from.id) {
      await ctx.answerPreCheckoutQuery(false, {
        error_message: 'Order does not match your account. Please try again.',
      });
      return;
    }

    if (q.currency !== 'XTR') {
      await ctx.answerPreCheckoutQuery(false, {
        error_message: 'Unsupported currency.',
      });
      return;
    }

    const product = getProduct(parsed.productId);
    if (q.total_amount !== product.starsAmount) {
      await ctx.answerPreCheckoutQuery(false, {
        error_message: 'Price changed. Please try again.',
      });
      return;
    }

    await ctx.answerPreCheckoutQuery(true);
  });

  bot.on('message:successful_payment', async (ctx) => {
    const payment = ctx.message.successful_payment;
    const from = ctx.from;
    if (!from) {
      console.error('successful_payment without ctx.from');
      return;
    }

    const parsed = parseInvoicePayload(payment.invoice_payload);
    if (!parsed) {
      // Сюда дошли — значит pre_checkout пропустил. Логируем, но юзеру
      // отвечать нечем — он уже заплатил, refund возможен через 90 дней.
      console.error('successful_payment with invalid payload', payment.invoice_payload);
      return;
    }

    if (parsed.productId !== 'replay') {
      console.error('successful_payment for unknown product', parsed.productId);
      return;
    }

    try {
      const result = await grantReplayCredit({
        telegramId: from.id,
        username: from.username ?? null,
        firstName: from.first_name ?? null,
        telegramPaymentId: payment.telegram_payment_charge_id,
        starsAmount: payment.total_amount,
      });

      if (!result.wasNew) {
        // Дубль webhook — товар уже зачислен, юзеру второе сообщение не шлём.
        return;
      }
    } catch (err) {
      console.error('grant_replay_credit failed', err);
      // Даже если запись в БД упала, деньги уже списаны. Лучше сообщить юзеру
      // что что-то пошло не так, чем молчать.
      await ctx.reply(
        '⚠️ Payment received but we hit an issue crediting your replay. ' +
          'Please contact support — your purchase is safe.',
      );
      return;
    }

    await ctx.reply(
      '✅ Payment received! You got *1 extra game today* — open Word Royale and play again.',
      { parse_mode: 'Markdown' },
    );
  });
}
