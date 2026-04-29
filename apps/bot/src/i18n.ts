// Bot i18n shim. Минимум для того, чтобы команды/платёжные ответы шли
// на родном языке юзера. Источник языка — `ctx.from.language_code`
// (что соответствует языку Telegram-аккаунта, обычно совпадает с языком
// Mini App). Для тонкой настройки можно читать `users.language_code` из БД,
// но это +1 query на каждое сообщение — пока обходимся без.

const RU_LANGS = new Set(['ru', 'uk', 'be', 'kk']);

export type BotLang = 'en' | 'ru';

export function detectBotLang(input: string | null | undefined): BotLang {
  if (typeof input === 'string' && RU_LANGS.has(input.toLowerCase())) {
    return 'ru';
  }
  return 'en';
}

const STRINGS = {
  welcome_title: { en: '*Word Royale*', ru: '*Word Royale*' },
  welcome_body: {
    en: [
      'Make as many words as you can from 7 letters in 90 seconds.',
      'Same puzzle for everyone, every day.',
      '',
      'Tap *Play* to start.',
    ].join('\n'),
    ru: [
      'Составляй как можно больше слов из 7 букв за 90 секунд.',
      'Один паззл для всего мира — каждый день новый.',
      '',
      'Нажми *Играть*, чтобы начать.',
    ].join('\n'),
  },
  play_button: { en: '▶️ Play', ru: '▶️ Играть' },
  could_not_save: {
    en: 'Could not save your preference. Please try again later.',
    ru: 'Не получилось сохранить настройку. Попробуй позже.',
  },
  not_registered: {
    en:
      "Play at least once first — that's when we create your profile. Then come back and run /notifications_off if you don't want reminders.",
    ru:
      'Сначала сыграй хотя бы раз — тогда мы создадим твой профиль. Потом вернись и выполни /notifications_off, если не хочешь напоминаний.',
  },
  notifications_off_confirmed: {
    en: [
      'Daily reminders turned off.',
      '',
      'Run /notifications_on to bring them back when you want a nudge.',
    ].join('\n'),
    ru: [
      'Ежедневные напоминания выключены.',
      '',
      'Выполни /notifications_on, чтобы включить их обратно.',
    ].join('\n'),
  },
  notifications_on_confirmed: {
    en: 'Daily reminders are on. We will ping you at 09:00 your local time on days you have not played yet.',
    ru: 'Напоминания включены. Будем стучаться в 09:00 по твоему времени в дни, когда ты ещё не играл.',
  },
  invoice_invalid_order: {
    en: 'Invalid order. Please try again.',
    ru: 'Некорректный заказ. Попробуй ещё раз.',
  },
  invoice_user_mismatch: {
    en: 'Order does not match your account. Please try again.',
    ru: 'Заказ не совпадает с твоим аккаунтом. Попробуй ещё раз.',
  },
  payment_replay_success: {
    en: '✓ Replay added. Open Word Royale and tap *Play* to use it.',
    ru: '✓ Реплей зачислен. Открой Word Royale и нажми *Играть*.',
  },
  payment_theme_success: {
    en: '✓ Theme unlocked. Open Word Royale → Shop → Apply.',
    ru: '✓ Тема разблокирована. Открой Word Royale → Магазин → Применить.',
  },
  payment_double_score_success: {
    en: '✓ ×2 boost activated for today. Your next score will be doubled.',
    ru: '✓ ×2 буст активирован на сегодня. Следующий счёт будет удвоен.',
  },
  payment_pro_success: {
    en: '✓ Word Pro is active. Unlimited replays + all themes.',
    ru: '✓ Word Pro активирован. Безлимит реплеев + все темы.',
  },
  payment_generic_success: {
    en: '✓ Purchase confirmed.',
    ru: '✓ Покупка подтверждена.',
  },
  refund_confirmed: {
    en: 'Your refund was processed. The item has been removed from your account.',
    ru: 'Возврат проведён. Товар удалён из твоего аккаунта.',
  },
} as const;

type StringKey = keyof typeof STRINGS;

export function bt(key: StringKey, lang: BotLang): string {
  const entry = STRINGS[key];
  return entry[lang] ?? entry.en;
}
