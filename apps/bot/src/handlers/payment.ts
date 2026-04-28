// Stars-платежи. Два хендлера:
//   1. pre_checkout_query — последний шанс отказать перед списанием. Telegram
//      даёт 10 секунд. Если не ответили или ok=false — деньги не списываются.
//   2. successful_payment — деньги уже списаны, Telegram прислал подтверждение.
//      Зачисляем товар атомарной RPC grant_replay_credit. Идемпотентно по
//      telegram_payment_charge_id (если webhook ретрайнется, второй раз товар
//      не зачислится).

import type { Bot } from 'grammy';
import {
  getProduct,
  isThemeProductId,
  themeIdFromProductId,
} from '../products.js';
import { parseInvoicePayload } from './buy.js';
import {
  grantDoubleScore,
  grantProSubscription,
  grantReplayCredit,
  grantTheme,
  revokePurchase,
} from '../supabase.js';
import { posthog } from '../posthog.js';

export function registerPaymentHandlers(bot: Bot): void {
  bot.on('pre_checkout_query', async (ctx) => {
    const q = ctx.preCheckoutQuery;

    const parsed = parseInvoicePayload(q.invoice_payload);
    if (!parsed) {
      posthog.capture({
        distinctId: String(q.from.id),
        event: 'payment_checkout_rejected',
        properties: { reason: 'invalid_payload' },
      });
      await ctx.answerPreCheckoutQuery(false, {
        error_message: 'Invalid order. Please try again.',
      });
      return;
    }

    if (parsed.telegramUserId !== q.from.id) {
      posthog.capture({
        distinctId: String(q.from.id),
        event: 'payment_checkout_rejected',
        properties: { reason: 'user_mismatch', product_id: parsed.productId },
      });
      await ctx.answerPreCheckoutQuery(false, {
        error_message: 'Order does not match your account. Please try again.',
      });
      return;
    }

    if (q.currency !== 'XTR') {
      posthog.capture({
        distinctId: String(q.from.id),
        event: 'payment_checkout_rejected',
        properties: { reason: 'unsupported_currency', currency: q.currency, product_id: parsed.productId },
      });
      await ctx.answerPreCheckoutQuery(false, {
        error_message: 'Unsupported currency.',
      });
      return;
    }

    const product = getProduct(parsed.productId);
    if (q.total_amount !== product.starsAmount) {
      posthog.capture({
        distinctId: String(q.from.id),
        event: 'payment_checkout_rejected',
        properties: { reason: 'price_mismatch', product_id: parsed.productId, expected_stars: product.starsAmount, actual_stars: q.total_amount },
      });
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

    const grantBase = {
      telegramId: from.id,
      username: from.username ?? null,
      firstName: from.first_name ?? null,
      telegramPaymentId: payment.telegram_payment_charge_id,
      starsAmount: payment.total_amount,
    };

    let wasNew: boolean;
    let successText: string;

    try {
      if (parsed.productId === 'replay') {
        const result = await grantReplayCredit(grantBase);
        wasNew = result.wasNew;
        successText =
          '✅ Payment received! You got *1 extra game today* — open Word Royale and play again.';
      } else if (parsed.productId === 'double_score') {
        const result = await grantDoubleScore(grantBase);
        wasNew = result.wasNew;
        successText =
          '✅ Payment received! *Double score* is active — your next game today will count for 2×.';
      } else if (parsed.productId === 'pro_subscription') {
        const result = await grantProSubscription(grantBase);
        wasNew = result.wasNew;
        const until = result.expiresAt
          ? new Date(result.expiresAt).toUTCString().slice(0, 16)
          : '30 days from now';
        successText = `✅ Payment received! *Word Pro* active until ${until} — unlimited daily plays + all themes.`;
      } else if (isThemeProductId(parsed.productId)) {
        const themeId = themeIdFromProductId(parsed.productId);
        const product = getProduct(parsed.productId);
        const result = await grantTheme({ ...grantBase, themeId });
        wasNew = result.wasNew;
        successText = `✅ Payment received! *${product.title}* unlocked — open Word Royale and apply it from Shop.`;
      } else {
        console.error('successful_payment for unknown product', parsed.productId);
        return;
      }
    } catch (err) {
      console.error('grant_*  failed', err);
      posthog.capture({
        distinctId: String(from.id),
        event: 'grant_failed',
        properties: {
          product_id: parsed.productId,
          stars_amount: payment.total_amount,
          telegram_payment_id: payment.telegram_payment_charge_id,
        },
      });
      posthog.captureException(err, String(from.id), {
        product_id: parsed.productId,
        telegram_payment_id: payment.telegram_payment_charge_id,
      });
      // Даже если запись в БД упала, деньги уже списаны. Лучше сообщить юзеру
      // что что-то пошло не так, чем молчать.
      await ctx.reply(
        '⚠️ Payment received but we hit an issue applying your purchase. ' +
          'Please contact support — your payment is safe.',
      );
      return;
    }

    if (!wasNew) {
      // Дубль webhook — товар уже зачислен, юзеру второе сообщение не шлём.
      return;
    }

    posthog.capture({
      distinctId: String(from.id),
      event: 'payment_completed',
      properties: {
        product_id: parsed.productId,
        stars_amount: payment.total_amount,
        telegram_payment_id: payment.telegram_payment_charge_id,
        $set: {
          username: from.username ?? null,
          first_name: from.first_name ?? null,
        },
      },
    });

    await ctx.reply(successText, { parse_mode: 'Markdown' });
  });

  // Stars refund (юзер вернул через Telegram support в течение 90 дней).
  // Telegram шлёт нам service-message с payload оригинального платежа.
  // Унвидим благо через revoke_purchase (идемпотентно по telegram_payment_id).
  bot.on('message:refunded_payment', async (ctx) => {
    const refund = ctx.message.refunded_payment;
    const from = ctx.from;
    if (!from) {
      console.error('refunded_payment without ctx.from');
      return;
    }

    try {
      const result = await revokePurchase({
        telegramPaymentId: refund.telegram_payment_charge_id,
        telegramUserId: from.id,
      });

      if (!result.ok) {
        // Платёж не записан или mismatch — ничего не откатили.
        // Если ok=false и productId не null — был mismatch, логируем.
        if (result.productId) {
          console.error(
            'revoke_purchase mismatch — refund for foreign payment?',
            { paymentId: refund.telegram_payment_charge_id, telegramId: from.id },
          );
        }
        // Юзер всё равно получит Stars обратно от Telegram, мы тут только
        // отвязываем благо. Сообщать ему нечего.
        return;
      }

      if (result.wasAlreadyRefunded) {
        // Дубль service-message — уже отозвали при предыдущем хите.
        return;
      }

      posthog.capture({
        distinctId: String(from.id),
        event: 'payment_refunded',
        properties: {
          product_id: result.productId,
          telegram_payment_id: refund.telegram_payment_charge_id,
        },
      });

      // Шлём подтверждение, чтобы юзер видел — мы знаем про refund.
      // Текст краткий, Telegram сам показывает банковское подтверждение возврата.
      await ctx.reply(
        '↩️ Refund processed. The purchase has been revoked from your account.',
      );
    } catch (err) {
      console.error('revoke_purchase failed', err);
      posthog.captureException(err, String(from.id), {
        telegram_payment_id: refund.telegram_payment_charge_id,
      });
      // Stars уже вернулись юзеру, мы ничего сделать не можем — только лог.
    }
  });
}
