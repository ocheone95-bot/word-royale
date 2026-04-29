// Word Royale — простой i18n shim без зависимостей.
// EN — fallback. RU добавлен по retention-roadmap (Сессия 13, фича #5).
//
// Алгоритм авто-выбора:
//   1. localStorage 'wr.lang' (юзер вручную переключил в MeScreen) — приоритет.
//   2. WebApp.initDataUnsafe.user.language_code (ru/uk/be/kk → ru) — авто-детект.
//   3. default 'en'.
//
// Контракт `t(key, params?)`:
//   - params поддерживает примитивы (string|number) — подставляются как {name}.
//   - неизвестный ключ → строка-пустышка в dev (warn в console), 'key' в prod.
//
// Plurals:
//   - функция plural(n, forms) — возвращает forms[n === 1 ? 'one' : 'other']
//     (или RU-правила one/few/other), затем подставляется через t() как обычный string.

import { useEffect, useState } from 'react'

export type Lang = 'en' | 'ru'

const STORAGE_KEY = 'wr.lang'
const RU_LANGS = new Set(['ru', 'uk', 'be', 'kk'])

type Listener = (lang: Lang) => void

let currentLang: Lang = 'en'
const listeners = new Set<Listener>()

function readStoredLang(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'en' || v === 'ru') return v
  } catch {
    // localStorage may be unavailable
  }
  return null
}

function detectFromTelegram(): Lang | null {
  try {
    const w = window as unknown as {
      Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } }
    }
    const code = w.Telegram?.WebApp?.initDataUnsafe?.user?.language_code
    if (typeof code === 'string') {
      return RU_LANGS.has(code.toLowerCase()) ? 'ru' : 'en'
    }
  } catch {
    // not in Telegram context
  }
  return null
}

export function detectLang(): Lang {
  const stored = readStoredLang()
  if (stored) return stored
  const fromTg = detectFromTelegram()
  if (fromTg) return fromTg
  return 'en'
}

export function getLang(): Lang {
  return currentLang
}

export function setLang(lang: Lang): void {
  if (currentLang === lang) return
  currentLang = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // best-effort persistence
  }
  listeners.forEach((fn) => fn(lang))
}

export function subscribeLang(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

// Initial detect — выполняется один раз при импорте модуля.
currentLang = detectLang()

export function useLang(): Lang {
  const [lang, setLangState] = useState<Lang>(currentLang)
  useEffect(() => subscribeLang(setLangState), [])
  return lang
}

// Plural-формы. EN: 1 → one, иначе other. RU: 1, 21, 31, … → one;
// 2-4, 22-24, … → few; 5-20, 25-30, … → other (мн. число genitive).
export function plural(
  n: number,
  forms: { one: string; few?: string; other: string },
): string {
  if (currentLang === 'en') return n === 1 ? forms.one : forms.other
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms.one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms.few ?? forms.other
  return forms.other
}

// Все строки в одном объекте. Ключ-канон в EN (читаемый),
// RU — параллельный перевод. Для plurals используем helper plural().
type Strings = typeof EN_STRINGS

const EN_STRINGS = {
  // Common
  'common.loading': 'Loading…',
  'common.you': 'You',
  'common.retry': 'Retry',
  'common.back': 'Back',
  'common.close': 'Close',

  // Days of the week (UTC weekdays for HomeScreen)
  'weekday.MONDAY': 'MONDAY',
  'weekday.TUESDAY': 'TUESDAY',
  'weekday.WEDNESDAY': 'WEDNESDAY',
  'weekday.THURSDAY': 'THURSDAY',
  'weekday.FRIDAY': 'FRIDAY',
  'weekday.SATURDAY': 'SATURDAY',
  'weekday.SUNDAY': 'SUNDAY',

  // Time labels
  'time.h_m_left': '{h}h {m}m left',
  'time.h_left': '{h}h left',
  'time.d_h_left': '{d}d {h}h left',
  'time.expiring': 'expiring',

  // TabBar
  'tab.home': 'HOME',
  'tab.board': 'BOARD',
  'tab.shop': 'SHOP',
  'tab.me': 'ME',

  // ProBadge / StreakChip
  'badge.pro': 'PRO',
  'badge.pro_trial': 'Pro trial · {time}',
  'badge.streak_tail_one': 'day streak',
  'badge.streak_tail_few': 'days streak',
  'badge.streak_tail_other': 'days streak',

  // HomeScreen
  'home.greeting': 'Hi, {name}',
  'home.todays_puzzle': "Today's puzzle",
  'home.day_label': 'Day {n} · {weekday}',
  'home.saloon_title': 'The Saloon',
  'home.play': '▶ Play',
  'home.play_another': '▶ Play another',
  'home.play_replay': '▶ Play replay ({n})',
  'home.buy_replay': 'Buy replay · {price} ⭐',
  'home.watch_ad': 'Watch ad → free replay',
  'home.ad_loading': 'Loading ad…',
  'home.ad_limit': 'Daily ad limit reached.',
  'home.ad_unavailable': 'Ad not available right now.',
  'home.played_today_credits_one':
    'You already played today. {n} replay ready.',
  'home.played_today_credits_few':
    'You already played today. {n} replays ready.',
  'home.played_today_credits_other':
    'You already played today. {n} replays ready.',
  'home.played_today_no_credits':
    'You already played today. Buy a replay or watch an ad to play again.',
  'home.invite_friends': 'Invite friends',
  'home.weekly_rank_top10': '♛ You\'re #{n} this week',
  'home.weekly_rank_top100': '♛ You\'re #{n} this week',
  'home.weekly_prize_top10': 'Top-10 · 30d Pro on Sun',
  'home.weekly_prize_top100': 'Top-100 · 5 free replays on Sun',
  'home.sound_on': 'On',
  'home.sound_off': 'Off',

  // GameScreen
  'game.score': 'SCORE',
  'game.time': 'TIME',
  'game.now_spelling': 'Now Spelling',
  'game.submit': 'Submit',
  'game.clear': 'Clear',
  'game.undo': 'Undo',
  'game.watch_ad_30s': 'Watch ad → +30s',
  'game.added_30s': '+30s added!',
  'game.boost_x2': '×2 boost',
  'game.feedback_too_short': 'Too short',
  'game.feedback_invalid': 'Not a word',
  'game.feedback_duplicate': 'Already found',

  // ResultScreen
  'result.round_over': 'Round over',
  'result.final_score': 'Final score',
  'result.boost_applied': '×2 boost applied',
  'result.streak_reward_label': '♛ Streak reward',
  'result.streak_headline_one': '{n} day streak',
  'result.streak_headline_few': '{n} day streak',
  'result.streak_headline_other': '{n} day streak',
  'result.streak_replay_credit': '+1 free replay credit',
  'result.streak_theme_neon': 'Free theme unlocked: NEON',
  'result.streak_pro_30d': 'Word Pro for 30 days',
  'result.streak_delivered': 'Reward delivered',
  'result.pro_trial_label': '♛ Word Pro unlocked',
  'result.pro_trial_headline': 'Free 24-hour trial',
  'result.pro_trial_body': 'Unlimited replays · all themes',
  'result.words_found': 'Words found',
  'result.best_word': 'Best word',
  'result.longest': 'Longest',
  'result.letters_one': '{n} letter',
  'result.letters_few': '{n} letters',
  'result.letters_other': '{n} letters',
  'result.weekly_rank': 'Weekly rank',
  'result.share': 'Share result',
  'result.home': 'Home',
  'result.play_again': 'Play again',
  'result.play_another': 'Play another',
  'result.play_replay': 'Play replay ({n})',
  'result.view_leaderboard': '♛ View leaderboard',
  'result.saving': 'Saving to leaderboard…',
  'result.saved': '✓ Saved to leaderboard',
  'result.could_not_save': 'Could not save result.',
  'result.open_in_telegram':
    'Open in Telegram to save your score to the leaderboard.',
  'result.error_env_missing': 'App is not configured.',
  'result.error_network': 'Network problem. Tap retry.',
  'result.error_invalid_init_data': 'Telegram session invalid. Reopen the bot.',
  'result.error_server_misconfigured': 'Server not ready. Try again in a minute.',
  'result.error_seed_mismatch': 'A new day has started — play again.',
  'result.error_letters_mismatch': 'Letters mismatch. Play again.',
  'result.error_score_mismatch': 'Score mismatch.',
  'result.error_duplicate_word': 'Duplicate word in submission.',
  'result.error_word_not_composable': 'Word does not match the letters.',
  'result.error_word_length': 'Word length out of range.',
  'result.error_words_not_in_dictionary': 'A word is not in the dictionary.',
  'result.error_bad_response': 'Server returned an unexpected response.',
  'result.error_no_replay':
    'Already played today. Buy a replay to save another result.',

  // LeaderboardScreen
  'lb.title': 'Leaderboard',
  'lb.friends': 'Friends',
  'lb.global': 'Global',
  'lb.week': 'Week',
  'lb.tournament_prizes': '♛ Tournament prizes',
  'lb.prizes_summary':
    'Top-10 → 30 days Word Pro · Top-100 → 5 free replays',
  'lb.ends_sunday': 'Ends Sun 23:59 UTC · {time}',
  'lb.self_rank': 'You: #{rank} · {pts} pts',
  'lb.could_not_load': 'Could not load the leaderboard.',
  'lb.empty_global': 'No scores yet today. Be the first.',
  'lb.empty_week': 'New tournament. Be the first to score.',
  'lb.empty_friends':
    "No friends here yet. Invite someone to play and you'll show up in each other's Friends leaderboard.",
  'lb.pts': 'pts',

  // ShopScreen
  'shop.title': 'Shop',
  'shop.replay_section': 'Replay',
  'shop.themes_section': 'Themes',
  'shop.boosts_section': 'Boosts',
  'shop.subscription_section': 'Subscription',
  'shop.replay_buy': 'Buy replay · {price} ⭐',
  'shop.replay_desc': 'Play one more time today.',
  'shop.theme_apply': 'Apply',
  'shop.theme_buy': 'Buy · {price} ⭐',
  'shop.theme_owned': 'Owned',
  'shop.theme_active': 'Active',
  'shop.double_score_buy': 'Buy ×2 boost · {price} ⭐',
  'shop.double_score_active': 'Active for today',
  'shop.double_score_desc': 'Double your next score.',
  'shop.pro_title': 'Word Pro',
  'shop.pro_price': '{price} ⭐ / month',
  'shop.pro_buy': 'Subscribe · {price} ⭐',
  'shop.pro_active_until': 'Active · until {date}',
  'shop.pro_perks_unlimited': 'Unlimited replays',
  'shop.pro_perks_themes': 'All themes unlocked',
  'shop.pro_perks_pro_board': 'Pro leaderboard',
  'shop.pro_perks_no_ads': 'No ads',

  // MeScreen
  'me.title': 'Profile',
  'me.section_today': 'Today',
  'me.section_membership': 'Membership',
  'me.section_alltime': 'All-time',
  'me.section_thisweek': 'This week',
  'me.section_language': 'Language',
  'me.todays_puzzle': "Today's puzzle",
  'me.played': 'Played',
  'me.not_yet': 'Not yet',
  'me.replay_credits': 'Replay credits',
  'me.double_score_boost': 'Double score boost',
  'me.active': 'Active',
  'me.dash': '—',
  'me.watch_ads': 'Watch ads',
  'me.word_pro': 'Word Pro',
  'me.trial_until': 'Trial · until {date}',
  'me.until': 'Until {date}',
  'me.free_tier': 'Free tier',
  'me.themes_owned': 'Themes owned',
  'me.themes_all_pro': 'All (Pro)',
  'me.themes_count': '{n} / 4',
  'me.best_score': 'Best score',
  'me.games_played': 'Games played',
  'me.days_played': 'Days played',
  'me.current_streak': 'Current streak',
  'me.best_streak': 'Best streak',
  'me.words_found': 'Words found',
  'me.longest_word': 'Longest word',
  'me.tournament_rank': 'Tournament rank',
  'me.total_score': 'Total score',
  'me.day_one': '{n} day',
  'me.day_few': '{n} days',
  'me.day_other': '{n} days',
  'me.could_not_load_stats': 'Could not load stats.',
  'me.open_shop': 'Open shop',
  'me.leaderboard': 'Leaderboard',
  'me.send_feedback': 'Send feedback',
  'me.player_fallback': 'Player',

  // OnboardingScreen
  'onb.skip': 'Skip',
  'onb.next': 'Next',
  'onb.start': 'Start playing',
  'onb.slide1_title': 'Welcome to Word Royale',
  'onb.slide1_body':
    'Make as many words as you can from 7 letters in 90 seconds.',
  'onb.slide2_title': 'One puzzle a day',
  'onb.slide2_body':
    'Same letters for everyone in the world. New ones every UTC midnight.',
  'onb.slide3_title': 'Climb the leaderboards',
  'onb.slide3_body':
    'Daily and weekly tournaments. Top players win Word Pro and free replays.',
} as const

type StringKey = keyof typeof EN_STRINGS

const RU_STRINGS: Record<StringKey, string> = {
  'common.loading': 'Загрузка…',
  'common.you': 'Ты',
  'common.retry': 'Повторить',
  'common.back': 'Назад',
  'common.close': 'Закрыть',

  'weekday.MONDAY': 'ПОНЕДЕЛЬНИК',
  'weekday.TUESDAY': 'ВТОРНИК',
  'weekday.WEDNESDAY': 'СРЕДА',
  'weekday.THURSDAY': 'ЧЕТВЕРГ',
  'weekday.FRIDAY': 'ПЯТНИЦА',
  'weekday.SATURDAY': 'СУББОТА',
  'weekday.SUNDAY': 'ВОСКРЕСЕНЬЕ',

  'time.h_m_left': 'осталось {h}ч {m}м',
  'time.h_left': 'осталось {h}ч',
  'time.d_h_left': 'осталось {d}д {h}ч',
  'time.expiring': 'истекает',

  'tab.home': 'ГЛАВНАЯ',
  'tab.board': 'ТАБЛО',
  'tab.shop': 'МАГАЗИН',
  'tab.me': 'ПРОФИЛЬ',

  'badge.pro': 'PRO',
  'badge.pro_trial': 'Pro триал · {time}',
  'badge.streak_tail_one': 'день подряд',
  'badge.streak_tail_few': 'дня подряд',
  'badge.streak_tail_other': 'дней подряд',

  'home.greeting': 'Привет, {name}',
  'home.todays_puzzle': 'Сегодняшний паззл',
  'home.day_label': 'День {n} · {weekday}',
  'home.saloon_title': 'Салун',
  'home.play': '▶ Играть',
  'home.play_another': '▶ Ещё раз',
  'home.play_replay': '▶ Реплей ({n})',
  'home.buy_replay': 'Купить реплей · {price} ⭐',
  'home.watch_ad': 'Реклама → бесплатный реплей',
  'home.ad_loading': 'Загрузка рекламы…',
  'home.ad_limit': 'Дневной лимит рекламы достигнут.',
  'home.ad_unavailable': 'Сейчас нет рекламы.',
  'home.played_today_credits_one':
    'Ты уже играл сегодня. Готов {n} реплей.',
  'home.played_today_credits_few':
    'Ты уже играл сегодня. Готовы {n} реплея.',
  'home.played_today_credits_other':
    'Ты уже играл сегодня. Готовы {n} реплеев.',
  'home.played_today_no_credits':
    'Ты уже играл сегодня. Купи реплей или посмотри рекламу, чтобы сыграть ещё.',
  'home.invite_friends': 'Пригласить друзей',
  'home.weekly_rank_top10': '♛ Ты #{n} на этой неделе',
  'home.weekly_rank_top100': '♛ Ты #{n} на этой неделе',
  'home.weekly_prize_top10': 'Топ-10 · 30д Pro в воскресенье',
  'home.weekly_prize_top100': 'Топ-100 · 5 реплеев в воскресенье',
  'home.sound_on': 'Вкл',
  'home.sound_off': 'Выкл',

  'game.score': 'ОЧКИ',
  'game.time': 'ВРЕМЯ',
  'game.now_spelling': 'Слово',
  'game.submit': 'OK',
  'game.clear': 'Сброс',
  'game.undo': 'Отмена',
  'game.watch_ad_30s': 'Реклама → +30с',
  'game.added_30s': '+30с добавлено!',
  'game.boost_x2': '×2 буст',
  'game.feedback_too_short': 'Слишком коротко',
  'game.feedback_invalid': 'Не слово',
  'game.feedback_duplicate': 'Уже есть',

  'result.round_over': 'Раунд окончен',
  'result.final_score': 'Итоговый счёт',
  'result.boost_applied': '×2 буст применён',
  'result.streak_reward_label': '♛ Награда за серию',
  'result.streak_headline_one': '{n} день подряд',
  'result.streak_headline_few': '{n} дня подряд',
  'result.streak_headline_other': '{n} дней подряд',
  'result.streak_replay_credit': '+1 бесплатный реплей',
  'result.streak_theme_neon': 'Бесплатная тема: NEON',
  'result.streak_pro_30d': 'Word Pro на 30 дней',
  'result.streak_delivered': 'Награда выдана',
  'result.pro_trial_label': '♛ Word Pro открыт',
  'result.pro_trial_headline': 'Триал на 24 часа',
  'result.pro_trial_body': 'Безлимит реплеев · все темы',
  'result.words_found': 'Слов найдено',
  'result.best_word': 'Лучшее слово',
  'result.longest': 'Длиннейшее',
  'result.letters_one': '{n} буква',
  'result.letters_few': '{n} буквы',
  'result.letters_other': '{n} букв',
  'result.weekly_rank': 'Место недели',
  'result.share': 'Поделиться',
  'result.home': 'Главная',
  'result.play_again': 'Сыграть снова',
  'result.play_another': 'Ещё раз',
  'result.play_replay': 'Реплей ({n})',
  'result.view_leaderboard': '♛ Открыть таблицу',
  'result.saving': 'Сохранение результата…',
  'result.saved': '✓ Сохранено в таблице',
  'result.could_not_save': 'Не получилось сохранить результат.',
  'result.open_in_telegram':
    'Открой в Telegram, чтобы счёт попал в таблицу.',
  'result.error_env_missing': 'Приложение не настроено.',
  'result.error_network': 'Проблема со связью. Нажми «Повторить».',
  'result.error_invalid_init_data':
    'Сессия Telegram устарела. Открой бота заново.',
  'result.error_server_misconfigured':
    'Сервер ещё не готов. Попробуй через минуту.',
  'result.error_seed_mismatch': 'Уже новый день — сыграй снова.',
  'result.error_letters_mismatch': 'Буквы не совпадают. Сыграй снова.',
  'result.error_score_mismatch': 'Несовпадение очков.',
  'result.error_duplicate_word': 'Слово отправлено дважды.',
  'result.error_word_not_composable': 'Слово не из этих букв.',
  'result.error_word_length': 'Длина слова вне диапазона.',
  'result.error_words_not_in_dictionary': 'Слова нет в словаре.',
  'result.error_bad_response': 'Сервер вернул неожиданный ответ.',
  'result.error_no_replay':
    'Уже играл сегодня. Купи реплей, чтобы сохранить новый результат.',

  'lb.title': 'Таблица лидеров',
  'lb.friends': 'Друзья',
  'lb.global': 'Все',
  'lb.week': 'Неделя',
  'lb.tournament_prizes': '♛ Призы турнира',
  'lb.prizes_summary':
    'Топ-10 → 30 дней Word Pro · Топ-100 → 5 бесплатных реплеев',
  'lb.ends_sunday': 'Финиш в Вс 23:59 UTC · {time}',
  'lb.self_rank': 'Ты: #{rank} · {pts} очк.',
  'lb.could_not_load': 'Не получилось загрузить таблицу.',
  'lb.empty_global': 'Сегодня ещё никто не играл. Будь первым.',
  'lb.empty_week': 'Новый турнир. Будь первым.',
  'lb.empty_friends':
    'Друзей пока нет. Пригласи кого-нибудь — будете видеть друг друга в таблице друзей.',
  'lb.pts': 'очк.',

  'shop.title': 'Магазин',
  'shop.replay_section': 'Реплей',
  'shop.themes_section': 'Темы',
  'shop.boosts_section': 'Бусты',
  'shop.subscription_section': 'Подписка',
  'shop.replay_buy': 'Купить реплей · {price} ⭐',
  'shop.replay_desc': 'Сыграть ещё раз сегодня.',
  'shop.theme_apply': 'Применить',
  'shop.theme_buy': 'Купить · {price} ⭐',
  'shop.theme_owned': 'Куплено',
  'shop.theme_active': 'Активна',
  'shop.double_score_buy': 'Купить ×2 буст · {price} ⭐',
  'shop.double_score_active': 'Активен сегодня',
  'shop.double_score_desc': 'Удвоить следующий счёт.',
  'shop.pro_title': 'Word Pro',
  'shop.pro_price': '{price} ⭐ / месяц',
  'shop.pro_buy': 'Подписаться · {price} ⭐',
  'shop.pro_active_until': 'Активна · до {date}',
  'shop.pro_perks_unlimited': 'Безлимит реплеев',
  'shop.pro_perks_themes': 'Все темы открыты',
  'shop.pro_perks_pro_board': 'Pro-таблица',
  'shop.pro_perks_no_ads': 'Без рекламы',

  'me.title': 'Профиль',
  'me.section_today': 'Сегодня',
  'me.section_membership': 'Членство',
  'me.section_alltime': 'За всё время',
  'me.section_thisweek': 'Эта неделя',
  'me.section_language': 'Язык',
  'me.todays_puzzle': 'Сегодняшний паззл',
  'me.played': 'Сыграно',
  'me.not_yet': 'Ещё нет',
  'me.replay_credits': 'Реплеев',
  'me.double_score_boost': 'Буст ×2',
  'me.active': 'Активен',
  'me.dash': '—',
  'me.watch_ads': 'Просмотры рекламы',
  'me.word_pro': 'Word Pro',
  'me.trial_until': 'Триал · до {date}',
  'me.until': 'До {date}',
  'me.free_tier': 'Бесплатно',
  'me.themes_owned': 'Тем куплено',
  'me.themes_all_pro': 'Все (Pro)',
  'me.themes_count': '{n} / 4',
  'me.best_score': 'Лучший счёт',
  'me.games_played': 'Игр сыграно',
  'me.days_played': 'Дней играно',
  'me.current_streak': 'Серия сейчас',
  'me.best_streak': 'Лучшая серия',
  'me.words_found': 'Слов найдено',
  'me.longest_word': 'Длиннейшее слово',
  'me.tournament_rank': 'Место в турнире',
  'me.total_score': 'Сумма очков',
  'me.day_one': '{n} день',
  'me.day_few': '{n} дня',
  'me.day_other': '{n} дней',
  'me.could_not_load_stats': 'Не получилось загрузить статистику.',
  'me.open_shop': 'Открыть магазин',
  'me.leaderboard': 'Таблица',
  'me.send_feedback': 'Написать фидбек',
  'me.player_fallback': 'Игрок',

  'onb.skip': 'Пропустить',
  'onb.next': 'Дальше',
  'onb.start': 'Поехали',
  'onb.slide1_title': 'Привет от Word Royale',
  'onb.slide1_body':
    'Составляй как можно больше слов из 7 букв за 90 секунд.',
  'onb.slide2_title': 'Один паззл в день',
  'onb.slide2_body':
    'Те же буквы для всего мира. Новые каждые сутки в 00:00 UTC.',
  'onb.slide3_title': 'Поднимись в таблице',
  'onb.slide3_body':
    'Дневной и недельный турниры. Топ-игроки получают Word Pro и реплеи.',
}

const ALL_STRINGS: Record<Lang, Strings> = {
  en: EN_STRINGS,
  ru: RU_STRINGS as Strings,
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = params[key]
    return v === undefined || v === null ? `{${key}}` : String(v)
  })
}

export function t(
  key: StringKey,
  params?: Record<string, string | number>,
): string {
  const dict = ALL_STRINGS[currentLang] ?? EN_STRINGS
  const template = dict[key] ?? EN_STRINGS[key]
  if (typeof template !== 'string') {
    if (import.meta.env.DEV) {
      console.warn('i18n missing key', key)
    }
    return String(key)
  }
  return interpolate(template, params)
}

// Helper для plural-ключей: на входе base = 'home.played_today_credits',
// автоматически выберет _one / _few / _other.
export function tPlural(
  base: string,
  n: number,
  params?: Record<string, string | number>,
): string {
  const form = plural(n, { one: '_one', few: '_few', other: '_other' })
  const key = `${base}${form}` as StringKey
  return t(key, { n, ...(params ?? {}) })
}
