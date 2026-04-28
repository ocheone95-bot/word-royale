// Общие лимиты, используемые несколькими Edge Functions.
// Источник правды — здесь. record-ad-reward проставляет лимит в RPC,
// today-status возвращает то же значение клиенту для UI-счётчика «N left».

// Сколько rewarded ads юзер может посмотреть в сутки. Защита от brute-force
// фарминга бесплатных replay-кредитов через спам-просмотры.
export const ADS_MAX_PER_DAY = 3;
