# 🎮 Word Royale — Telegram Mini App

> **Документ для AI-ассистента (Claude Code).** Прочти этот файл целиком перед началом любой задачи. Это единый источник правды о проекте.

---

## 📋 Кратко о проекте

**Word Royale** — это казуальная мобильная игра в формате Telegram Mini App, в которой игроки за 90 секунд составляют максимум слов из заданного набора букв. Каждый день — одинаковый набор букв для всех игроков мира (как в Wordle), что создаёт ежедневное возвращение и социальное сравнение.

**Тип:** Hybrid-casual word puzzle с социальным лидербордом и подпиской.

**Платформа:** Telegram Mini App (web-приложение, запускающееся внутри Telegram).

**Целевая аудитория:** Casual-игроки 18-45 лет, активные в Telegram, любящие quick-fix геймплей (Wordle, Words With Friends, Royal Match).

---

## 🎯 Цели проекта

### Бизнес-цели
1. **Запустить MVP за 6 недель** силами одного PM с помощью AI-кодинга.
2. **Достичь 1000 органических игроков** в первый месяц после запуска.
3. **Валидировать монетизацию:** хотя бы 1-2% игроков совершают покупку через Telegram Stars.
4. **Получить D7 retention 15%+** (бенчмарк casual-игр).

### Продуктовые цели MVP
- Игрок может зайти в бота и начать играть **за 10 секунд без онбординга**.
- Игрок понимает результат и хочет вернуться **завтра**.
- Игрок может **поделиться результатом** в чат одной кнопкой.
- Игрок может **купить подписку через Telegram Stars** без ухода из приложения.

### Метрики успеха (отслеживаем с дня 1)
| Метрика | Цель MVP | Что значит |
|---|---|---|
| D1 retention | 35%+ | Возврат на следующий день |
| D7 retention | 15%+ | Привычка сформирована |
| K-фактор | 0.3+ | Виральность работает |
| Conversion to first Stars purchase | 1-2% | Микро-IAP покупают |
| Avg session length | 60-120 сек | Casual-формат |

---

## 👤 Контекст разработчика

- **Роль:** Product Manager (не профессиональный разработчик).
- **Опыт кодинга:** базовый — успешно делал статичный сайт на HTML/CSS/JS с помощью AI.
- **Среда:** macOS, Git, GitHub аккаунт есть, Node.js установлен.
- **Команда:** соло (только PM + Claude Code).
- **Бюджет:** $0 на инфраструктуру (используем только бесплатные тиры).
- **Время:** 8-15 часов в неделю.

**Это значит для AI:**
- Объясняй каждое нетривиальное действие словами.
- Давай точные команды для терминала, не «общие шаги».
- Если есть несколько способов сделать — выбирай **самый простой**, не самый «правильный».
- Перед сложным изменением — кратко объясняй ЗАЧЕМ это делаем.
- Любой код должен быть **запускаемым с первой попытки**, не «псевдокод».

---

## 🛠️ Технологический стек

### Frontend (Mini App)
- **Framework:** React 19 + TypeScript (Node 22+)
- **Build:** Vite 8
- **Стилизация:** Tailwind CSS v4 (через `@tailwindcss/vite` plugin)
- **Telegram интеграция:** `@telegram-apps/sdk-react` v3.x
- **State:** Zustand (простой, не Redux)
- **Хостинг:** Vercel (бесплатный тир)

### Backend
- **БД + Auth + Realtime:** Supabase (бесплатно до 50k MAU)
- **Edge Functions:** Supabase Edge Functions для проверки платежей и серверной логики
- **Telegram Bot:** Node.js + `grammY` библиотека
- **Хостинг бота:** Vercel Serverless Functions (бесплатный тир)

### Внешние сервисы
- **Платежи:** Telegram Stars (нативно через Bot API)
- **Реклама:** Monetag (rewarded ads для TMA)
- **Аналитика:** PostHog (бесплатно до 1M событий/мес)
- **Error tracking:** Sentry (бесплатный тир)

### Языки и форматы
- **Код:** TypeScript везде, где возможно (включая backend)
- **Комментарии в коде:** на русском, для будущего понимания
- **Названия переменных, функций, файлов:** на английском
- **UI текст:** английский (для широкой аудитории)

---

## 🎲 Игровая механика (детально)

### Core loop — одна сессия (~2 минуты)
1. Игрок открывает Mini App из бота или ссылки.
2. Видит **сегодняшний набор из 7 букв** (одинаковый для всех в мире).
3. Нажимает «Play» — запускается **таймер 90 секунд**.
4. Составляет слова, выбирая буквы тапом или свайпом.
5. Каждое валидное слово даёт очки:
   - 3 буквы: 100 очков
   - 4 буквы: 400 очков
   - 5 букв: 1200 очков
   - 6 букв: 2000 очков
   - 7 букв (все буквы): 4000 очков + бонус
6. После таймера: **экран результата** со скором, списком найденных слов и позицией в лидерборде.
7. Кнопка «Share result» — отправляет в чат сообщение со скором и шаблонным эмодзи-визуалом (как Wordle).

### Daily challenge
- Каждый день в 00:00 UTC меняется набор букв.
- Набор детерминирован seed'ом от даты — у всех мира одинаковый.
- Игрок может играть **1 раз бесплатно в день**, повторы — за Stars или с подпиской.

### Лидерборд
- **Global Top-100** на сегодня.
- **Friends Leaderboard** — друзья из Telegram, которые тоже играют.
- **All-time stats** — личная статистика игрока.

### Прогрессия
- Монеты за каждую игру (1 очко = 1 монета).
- Монеты тратятся на разблокировку **визуальных тем букв** (неон, ретро, сакура, киберпанк).
- Темы — чисто косметика, не влияют на геймплей.

---

## 💰 Монетизация (детально)

### Уровень 1: Free
- 1 игра в день
- Базовая тема букв
- Просмотр rewarded ad → +30 секунд к таймеру или подсказка (раскрытие 3 случайных букв в одном слове)

### Уровень 2: Telegram Stars (микро-IAP)
- **50 ⭐ (~$0.85)** — повтор сегодняшнего набора букв
- **100 ⭐ (~$1.70)** — премиум тема букв (одна навсегда)
- **200 ⭐ (~$3.40)** — буст «удвоить очки» на сегодня

### Уровень 3: Подписка «Word Pro»
- **150 ⭐/месяц (~$2.55)**
- Безлимитные попытки в день
- Все темы разблокированы
- Эксклюзивный Pro-лидерборд (только подписчики)
- Расширенная статистика
- Без рекламы

### Реклама
- **Только rewarded video** — никаких принудительных interstitial.
- Появляется по кнопке игрока за конкретный бонус.
- Через Monetag SDK для TMA.

---

## 🗂️ Структура репозитория

```
word-royale/
├── apps/
│   ├── miniapp/              # React + Vite frontend
│   │   ├── src/
│   │   │   ├── components/   # UI компоненты
│   │   │   ├── screens/      # Экраны (Home, Game, Result, Leaderboard, Shop)
│   │   │   ├── hooks/        # React хуки (useTelegram, useGame)
│   │   │   ├── store/        # Zustand стейты
│   │   │   ├── lib/          # Утилиты (dictionary, scoring, daily-seed)
│   │   │   ├── types/        # TypeScript типы
│   │   │   └── App.tsx
│   │   ├── public/
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── bot/                  # Telegram bot (grammY)
│       ├── src/
│       │   ├── handlers/     # Обработчики команд
│       │   ├── payments/     # Логика Stars-платежей
│       │   └── index.ts
│       └── package.json
│
├── packages/
│   ├── shared/               # Общие типы и утилиты
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── scoring.ts    # Чтобы фронт и бэк считали одинаково
│   │   │   └── daily-seed.ts
│   │   └── package.json
│   │
│   └── dictionary/           # Словарь (большой, отдельный пакет)
│       ├── data/
│       │   └── english.json  # ~370k слов
│       └── package.json
│
├── supabase/
│   ├── migrations/           # SQL миграции
│   └── functions/            # Edge functions
│       ├── verify-payment/
│       └── submit-score/
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOY.md
│   └── TELEGRAM_SETUP.md
│
├── .env.example              # Шаблон env переменных
├── .gitignore
├── README.md
├── PROJECT.md                # ← этот файл
└── package.json              # Корневой package с workspaces
```

---

## 🗄️ Схема базы данных (Supabase / Postgres)

```sql
-- Игроки
create table users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique not null,
  username text,
  first_name text,
  photo_url text,
  coins int default 0,
  created_at timestamptz default now(),
  last_active_at timestamptz default now()
);

-- Игровые сессии
create table game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  daily_seed date not null,        -- какой день играл
  letters text not null,            -- 7 букв набора
  score int not null,
  words_found text[] not null,
  duration_sec int default 90,
  created_at timestamptz default now()
);

-- Подписки
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  tier text not null,               -- 'pro'
  status text not null,             -- 'active', 'expired', 'cancelled'
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  telegram_payment_id text unique,
  stars_amount int not null,
  created_at timestamptz default now()
);

-- Покупки (Stars)
create table purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  product_id text not null,         -- 'theme_neon', 'replay', 'double_score'
  stars_amount int not null,
  telegram_payment_id text unique,
  created_at timestamptz default now()
);

-- Разблокированные темы
create table user_themes (
  user_id uuid references users(id),
  theme_id text not null,
  unlocked_at timestamptz default now(),
  primary key (user_id, theme_id)
);

-- Реферальная программа
create table referrals (
  referrer_id uuid references users(id),
  referred_id uuid references users(id),
  created_at timestamptz default now(),
  reward_given boolean default false,
  primary key (referrer_id, referred_id)
);

-- Индексы для производительности
create index idx_game_sessions_user_date on game_sessions(user_id, daily_seed);
create index idx_game_sessions_daily_score on game_sessions(daily_seed, score desc);
create index idx_users_telegram_id on users(telegram_id);
```

---

## 🔐 Безопасность и валидация

### Правило №1: Никогда не доверяй клиенту
- Скор подсчитывается на клиенте для UX, но **окончательно валидируется на backend** через Supabase Edge Function.
- Edge Function проверяет: правильные ли буквы, существуют ли слова в словаре, корректный ли подсчёт очков.
- Если несоответствие → score не записывается, юзер логируется как подозрительный.

### Правило №2: Платежи — только через Telegram-сайд
- Все Stars-платежи проходят через Telegram Bot API.
- Бот получает webhook с подтверждением → пишет в `purchases` или `subscriptions`.
- Mini App никогда напрямую не выдаёт привилегии — только после подтверждения от бота.

### Правило №3: Stars refund 90 дней
- Telegram позволяет юзерам вернуть Stars в течение 90 дней.
- Нельзя выдавать невозвратные блага сразу (например, реальную крипту).
- В нашем случае — только виртуальные блага, риск минимален.

### Правило №4: Rate limiting
- Не больше 1 game session в день на free юзера (проверка по `telegram_id` + `daily_seed`).
- Подозрительная активность (10+ сессий за минуту) → блок.

---

## 📐 Принципы кода

### Что MUST быть в каждом файле кода
1. **Краткий комментарий сверху файла** — что он делает (на русском).
2. **TypeScript типы** для всех функций и компонентов.
3. **Никаких `any`** — если непонятен тип, использовать `unknown` и сужать.
4. **Обработка ошибок** — try/catch для async, fallback UI для React.

### Что НЕ делаем
- ❌ Не пишем тесты в MVP (добавим после валидации продукта).
- ❌ Не используем сложные state managers (Redux, MobX) — только Zustand.
- ❌ Не устанавливаем зависимости «на всякий случай» — только нужные.
- ❌ Не оптимизируем преждевременно — сначала работает, потом красиво.
- ❌ Не используем CSS-in-JS (styled-components и т.п.) — только Tailwind.

### Стиль React-компонентов
- Functional components + hooks (никаких classes).
- Один компонент = один файл.
- Имена в PascalCase: `GameScreen.tsx`, `LetterTile.tsx`.
- Хуки в camelCase с префиксом `use`: `useTelegram.ts`, `useDailyChallenge.ts`.

### Стиль работы с Supabase
- Никаких прямых SQL-запросов с фронта для записи данных — только через Edge Functions.
- Чтение публичных данных (лидерборд) — можно напрямую через Supabase Client.
- RLS (Row Level Security) включён на всех таблицах.

---

## 🚀 Roadmap MVP (6 недель)

### Неделя 1: Фундамент ✅
- [x] Setup репозитория, monorepo через npm workspaces
- [x] Создание React + Vite + TypeScript проекта
- [x] Регистрация бота через @BotFather (`@word_royale_bot`)
- [x] Hello World в Telegram (Mini App открывается из бота)
- [x] Telegram SDK интеграция, получение initData юзера
- [x] Базовый UI: главный экран с кнопкой Play
- [x] Loading и error states

> Production URL: https://word-royale-miniapp.vercel.app/ (Vercel project: `word-royale-miniapp`)

### Неделя 2: Core механика ✅
- [x] Загрузка английского словаря (SCOWL, ~26k слов 3-7 букв в JSON, ~70 KB gzip)
- [x] Алгоритм генерации daily seed (7 уникальных букв, минимум 3 гласных, детерминирован по UTC-дате)
- [x] Игровой экран: 7 букв в виде тайлов
- [x] Логика выбора букв (тап; свайп — техдолг на потом)
- [x] Проверка слова против словаря
- [x] Подсчёт очков
- [x] Таймер 90 секунд
- [x] Экран результата

### Неделя 3: Backend и социалка ✅
- [x] Supabase setup, миграции
- [x] Сохранение игровых сессий
- [x] Edge Function для валидации скора
- [x] Глобальный лидерборд топ-100
- [x] Friends лидерборд (через реферальную сеть, без требования взаимности в MVP)
- [x] Кнопка Share с Wordle-style эмодзи-визуалом + reф-ссылка в превью
- [x] Реферальная ссылка с трекингом (`startapp=ref_<id>` → Mini App + record-referral)

### Неделя 4: Монетизация ✅
- [x] Telegram Stars интеграция в бот (apps/bot, grammY, Vercel webhook)
- [x] Webhook на successful_payment (атомарный grant_replay_credit RPC)
- [x] Подписка Word Pro (150 ⭐/мес, bypass rate-limit + все темы, ручное продление)
- [x] Rate-limit «1 игра в день» + первый IAP replay (50 ⭐) — submit-score enforce
- [x] Микро-IAP: темы (100 ⭐, 4 цвета), double score (200 ⭐, one-shot ×2)
- [x] Monetag SDK для rewarded ads — каркас (+30s к таймеру, лимит 3/день; ждёт VITE_MONETAG_ZONE_ID)
- [x] Buy replay UI на HomeScreen / ResultScreen (deep-link `?start=buy_replay`)
- [x] Полноценный Shop-экран в Mini App (replay, темы, double score, Word Pro)

### Неделя 5: Polish
- [x] PostHog аналитика — все ключевые события
- [x] Sentry error tracking
- [x] Onboarding tutorial для новичков (3 экрана)
- [x] Refund-handler для Stars (migration 0012 + bot)
- [x] Server-side analytics в боте (posthog-node, события покупок и refund)
- [x] 4 темы букв с CSS-эффектами (закрыто в сессии 7)
- [x] Звуки и haptic feedback (Telegram WebApp API + WebAudio)
- [x] Полировка анимаций (tile pop, score tick-up, screen fade, slide-in)
- [x] Дизайн-проход Phase A/B/C: saloon-redesign по handoff Claude Design (5/6 экранов в новом бренде)
- [x] Дизайн-проход Phase D: Shop + 4 темы + Neo-Tokyo + CloudStorage onboarding (закрыто в сессии 11)
- [x] Bugfix / polish round 1: эмоджи убраны, MeScreen + lifetime stats, mobile adaptive PixelLogo, `_shared/game.ts` dedup, valibot ReDoS закрыт (сессия 12)

### Неделя 6: Запуск
- [ ] Closed beta — 20 друзей, 3 дня тестов
- [ ] Доработки по фидбеку
- [ ] Production deploy (Vercel + Supabase prod)
- [ ] Публикация бота
- [ ] Первый трафик: $50-100 через RichAds
- [ ] Запуск ✅

---

## 🌐 Переменные окружения

```bash
# .env.example — скопируй в .env и заполни

# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx  # Только в backend!

# Telegram
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_BOT_USERNAME=word_royale_bot
WEBAPP_URL=https://word-royale.vercel.app

# Аналитика
VITE_POSTHOG_KEY=xxx
VITE_POSTHOG_HOST=https://app.posthog.com

# Sentry
VITE_SENTRY_DSN=xxx

# Monetag (после регистрации)
VITE_MONETAG_ZONE_ID=xxx
```

---

## 📚 Ключевые ссылки на документацию

- [Telegram Mini Apps Docs](https://core.telegram.org/bots/webapps)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Stars Payments](https://core.telegram.org/bots/payments-stars)
- [@telegram-apps/sdk-react](https://docs.telegram-mini-apps.com/packages/telegram-apps-sdk-react)
- [grammY Bot Framework](https://grammy.dev/)
- [Supabase Docs](https://supabase.com/docs)
- [Vite Docs](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Monetag для TMA](https://monetag.com/)

---

## 🤖 Инструкции для Claude Code

### Как ты должен работать с этим проектом

1. **В начале каждой сессии** — прочитай этот файл (`PROJECT.md`).
2. **Перед изменением кода** — посмотри текущую структуру через `ls` или `tree`.
3. **При выполнении задач из roadmap** — отмечай выполненные пункты в этом файле (меняй `[ ]` на `[x]`).
4. **Если что-то не понятно** — задавай уточняющие вопросы, не угадывай.
5. **Когда даёшь команды для терминала** — пиши точные команды, не «псевдо-команды».
6. **При установке зависимостей** — фиксируй версии (через `package.json`).
7. **После каждого значимого изменения** — предлагай git commit с понятным сообщением.

### Формат твоих ответов

Структурируй ответы так:
1. **Что делаем и зачем** (1-2 предложения)
2. **Команды для терминала** (если нужны)
3. **Код** (полные файлы или точные diff)
4. **Что я (PM) должен проверить** (как убедиться, что всё работает)
5. **Следующий шаг** (что делаем дальше)

### Если я (PM) ошибся

Если я даю задачу, которая противоречит этому документу или принципам проекта — **скажи мне об этом**, не выполняй слепо. Объясни, в чём конфликт, и предложи альтернативу.

### Если ты (AI) не уверен

Лучше спросить и уточнить, чем сделать неправильно. Я PM, я понимаю trade-off'ы — объясни мне варианты, я выберу.

---

## ✅ Чеклист перед началом первой сессии

PM должен подготовить:
- [ ] Установлен Node.js 20+ (`node -v`)
- [ ] Установлен Git (`git --version`)
- [ ] Создан GitHub аккаунт
- [ ] Создан Supabase аккаунт (через GitHub)
- [ ] Создан Vercel аккаунт (через GitHub)
- [ ] Зарегистрирован бот через @BotFather (получен TOKEN)
- [ ] Установлен Telegram на телефоне для тестов
- [ ] Этот файл (PROJECT.md) лежит в корне репозитория

---

## 📝 Лог изменений документа

| Дата | Что изменилось |
|---|---|
| 2026-04-26 | Создан первоначальный документ |
| 2026-04-27 | Закрыта Неделя 1: деплой на Vercel, привязка Mini App в @BotFather, интеграция `@telegram-apps/sdk-react`, ErrorBoundary-fallback. Стек обновлён на фактический (React 19, Vite 8, Tailwind v4, Node 22+). |
| 2026-04-27 | Закрыта Неделя 2: словарь SCOWL в `packages/dictionary` (~26k слов после фильтра 3-7 букв, lazy chunk), алгоритм daily-seed в `packages/shared` (7 уникальных букв, ≥3 гласных, ~52 слова в среднем на набор), полный gameplay loop (выбор букв → валидация → счёт → таймер 90с → результат) на Zustand. Свайп пропущен сознательно — добавим после фидбека беты. Rate-limit «1 игра в день» придёт вместе со Stars на Неделе 4. |
| 2026-04-27 | Сессия 4. Backend Недели 3 сделан на 4/7 пунктов: Supabase БД (7 таблиц + RLS) через миграцию `0001_init.sql`, словарь залит в `dictionary_words` (25 912 слов), Edge Function `submit-score` с серверной re-валидацией (HMAC initData → seed → letters → каждое слово → score), глобальный топ-100 на сегодня в новом `LeaderboardScreen`. Социалка (Friends-лидерборд через рефералку, Share, реферальная ссылка) перенесена в Polish-неделю 5. Игровая логика дублирована в `supabase/functions/_shared/game.ts` из-за Deno bundler — это технический долг, закрыть snapshot-тестом. Edge Function задеплоена с `verify_jwt = false`, потому что новые `sb_publishable_*` ключи Supabase не парсятся gateway'ем как JWT; auth юзера живёт внутри функции через initData. |
| 2026-04-27 | Сессия 5. Закрыли хвост Недели 3: (1) Wordle-style Share-кнопка на ResultScreen — текст со скором и реф-ссылка `t.me/word_royale_bot/play?startapp=ref_<id>` через `t.me/share/url` и `WebApp.openTelegramLink`. (2) Реф-атрибуция: хук `useReferralAttribution` парсит `start_param` из raw initData, шлёт в Edge Function `record-referral` (PK на (referrer_id, referred_id) + self-referral guard + проверка что referrer уже существует). (3) Friends-tab на лидерборде через Edge Function `friends-leaderboard` (initData-auth, симметрично `submit-score`); friend = любая стрелка в `referrals`, без требования взаимности в MVP. (4) Snapshot-тест эквивалентности `@word-royale/shared` ↔ `_shared/game.ts` через Vitest (35 тестов, `npm test`). (5) Окно `auth_date` в `verify-init-data` снижено с 24 ч до 1 ч. Бот для команды `/start` не понадобился — `startapp=` открывает Mini App напрямую, реворк ботов отложен на отдельную сессию вместе со Stars. |
| 2026-04-27 | Сессия 6. Открыли Неделю 4 первым полным Stars-флоу. (1) `apps/bot` — отдельный Vercel-проект на grammY, webhook через `webhookCallback(bot, 'http')` с `secretToken`, базовый `/start` с кнопкой Mini App и обработка deep-link `?start=buy_replay` (сразу invoice, минуя приветствие). (2) Stars-pipeline: `/buy_replay` шлёт `sendInvoice` (provider_token='', currency XTR, 50 ⭐), `pre_checkout_query` валидирует payload/цену/совпадение `from.id`, `successful_payment` зовёт Postgres-функцию `grant_replay_credit` (миграция 0003) — атомарно делает upsert юзера, idempotent insert в `purchases` по `telegram_payment_charge_id`, +1 к `users.replay_credits`. (3) Миграция 0002 — `users.replay_credits` (счётчик, check ≥ 0) + `game_sessions.was_replay`. Миграция 0004 — `insert_game_session` RPC: атомарный rate-limit «1 игра в день» с расходом replay-токена. `submit-score` теперь возвращает `wasReplay`/`replayCreditsLeft` и 403 `no_replay`, если кредитов нет. (4) Edge Function `today-status` (initData-auth) для UI: `playedToday` + `replayCredits`. (5) Mini App: HomeScreen свапает primary-кнопку на «Buy replay · 50 ⭐» когда юзер играл и нет кредитов, ResultScreen — аналогично; статус подгружается на маунте и при `visibilitychange` (после возврата из чата с ботом после оплаты). Подписка Word Pro, темы (100 ⭐), double score (200 ⭐), Shop-экран и Monetag — следующая сессия. |
| 2026-04-28 | Сессия 8. Открыли Неделю 5 (Polish) четырьмя блоками. (1) **PostHog** аналитика: `posthog-js` + `lib/analytics.ts` (lazy init, no-op без `VITE_POSTHOG_KEY`, `person_profiles='identified_only'` чтобы не жечь MAU). Identify по telegram_id с username/first_name/language_code/is_premium. События: `app_opened`, `game_started`, `word_found`, `game_completed`, `share_clicked`, `referral_attributed`, `invite_clicked`, `shop_opened`, `theme_applied`, `ad_watched`, `iap_initiated` (replay/themes/double_score/pro × home/shop/result), `onboarding_*`. Бэкенд-события (successful_payment) пока не шлются — добавим server-side в следующей итерации. (2) **Sentry**: `@sentry/react` + `lib/sentry.ts`, init в main.tsx, ErrorBoundary.componentDidCatch ловит React-tree, captureMessage в submit-score/today-status для не-network-ошибок (seed_mismatch, score_mismatch и т.п.). DSN через `VITE_SENTRY_DSN`. (3) **Refund handler**: миграция 0012 — колонки `purchases.refunded/refunded_at` + RPC `revoke_purchase(p_telegram_payment_id, p_telegram_user_id)`, унвид по product_id (replay → -1 credit, double_score → null, pro → cancel + expires=now, theme → delete from user_themes). Идемпотентно, валидирует ownership. Бот: `bot.on('message:refunded_payment')` → RPC + краткий confirmation-reply. (4) **Onboarding**: 3-слайдовый туториал на новом `OnboardingScreen.tsx`, гейтится через `localStorage.wr.onboarding.done.v1`, читается синхронно в App. События `onboarding_started/step_viewed/completed/skipped` — будем смотреть воронку. Все блоки прошли build + 35 snapshot-тестов. Осталось PM: выкатить миграцию 0012, задеплоить бот, выдать `VITE_POSTHOG_KEY` и `VITE_SENTRY_DSN` в Vercel env. |
| 2026-04-28 | Сессия 10. Brand redesign по handoff'у Claude Design «Saloon-at-night» — Phase A/B/C (3 из 4 фаз). Эстетика: cozy retro arcade в ночном saloon-баре с котом-королём, тёплый CRT-glow, warm dark amber + brass + parchment. Решения PM зафиксированы перед стартом: cyberpunk заменяем на собственную 5-ю тему Neo-Tokyo (Phase D), product_id в БД оставляем как есть с visual mapping в коде, Shop делаем сами по принципам README, маскота рендерим JSX procedural без PNG-export, onboarding-флаг переезжает на TG CloudStorage с fallback на localStorage. (1) **Phase A — brand foundation:** `apps/miniapp/src/styles/design-tokens.css` (warm dark «saloon» палитра, 3 уровня glow, scanlines class, type-family tokens), Google Fonts в `index.html` (Bagel Fat One для display, Pixelify Sans для тайлов/цифр — brand-defining, Nunito для UI body), `components/PixelSprite.tsx` (TS-renderer 8-bit спрайтов через box-shadow stack — один div seed, каждый «лит» пиксель — item в shadow), `components/PixelLogo.tsx` (chunky 7×10 hand-plotted «WORD ROYALE», 3 уровня glow), `components/Mostaccio.tsx` (28×28 кот-король «Mostaccio» с brass crown, 13 поз процедурно через draw primitives — idle/sleep/tilt/jump/bigjump/trophy/hmpf/proud/blanket/point/pro/walk/smile, lazy memoization кеша). (2) **Phase B — saloon component library:** 8 компонентов в `components/saloon/` изолированно от legacy. LetterTile (круглая poker-chip плитка, brass border 3px, radial gradient, lift-shadow на selected с amber glow, transition cubic-bezier overshoot 160ms, optional order-badge), SaloonButton (4 варианта × 3 размера, primary с lamp glow + inset «лит» эффектом, Nunito 800 uppercase tracked), Card (table | leather surface, brass border 33%, soft shadow), StatPanel (близнец для Score/Timer, brass border 40%, glow на value, warning state с saloonPulseWarn keyframe для timer ≤10s), ProBadge (brass-tinted с pixel crown SVG), StreakChip (pill «♠ N day streak»), TabBar (bottom nav 4-tab с lamp glow на active), Scanlines (CRT overlay, prefers-reduced-motion отключает). (3) **Phase C — 5 из 6 экранов:** HomeScreen (PixelLogo «WORD ROYALE» с glow, Mostaccio в позе proud, Today's puzzle Card с превью 7 LetterTile size 32, Day-counter от LAUNCH_DATE 2026-04-26 + weekday + countdown to UTC midnight, bottom TabBar, Sound toggle переехал в footer link), GameScreen (StatPanel SCORE/TIME с warning state, Now Spelling Card с brass border + amber glow на word, Mostaccio локальной pose state с маппингом feedback → idle/tilt/jump/bigjump/hmpf и автовозвратом через 700ms, LetterTile rack 4+3 круглых тайлов 50px, Action row Undo/Submit/Clear, Found words chips, CRT scanlines 10%), ResultScreen (ROUND OVER pill с lamp+glow, Mostaccio trophy/proud/blanket по результату, big score 64px Pixelify highlight-amber с tick-up через useTickUp 800ms, Stats card с dashed dividers, Submit status block, Share+Replay+Watch ad+Leaderboard CTAs, scanlines 8%), LeaderboardScreen (scope toggle FRIENDS/GLOBAL pill, top-3 podium с brass-gold gradient у первого + crown-border + glow, list rows ниже с You-highlight rgba 14% + 3px lamp left border, TabBar внизу), OnboardingScreen (3 слайда с Mostaccio как guide: smile/point/pro, 1-й слайд с PixelLogo для бренда, Skip top-right, Next/Start playing CTA, dot-indicator с lamp glow на active). Всё сохраняет существующую логику (haptics, sounds, IAP deep-links, share, watch ad, submit-score, fetchLeaderboard, refreshTodayStatus). Build: +5.5 KB JS gzip (компоненты + Mostaccio definitions), -1.1 KB CSS gzip (Tailwind tree-shake удалил purple-классы), 35/35 snapshot-тестов. **Осталось Phase D на сессию 11:** Shop redesign в saloon-стиле, 4 темы переключение через override design-tokens (saloon/arcade/diner/kyoto), Neo-Tokyo для cyberpunk product_id, миграция onboarding-флага на CloudStorage с fallback на localStorage. ShopScreen — единственный экран на старой purple-палитре. Source of truth по дизайну: `/Users/dmtmnk/Downloads/word-royale.zip` (распакованный handoff в `/tmp/wr-design-review/design_handoff_word_royale/` — 555-строчный README + JSX исходники для всех phases). |
| 2026-04-28 | Сессия 9. Polish-блок продолжен тремя фичами: тактильная обратная связь, звуки, анимации. (1) **Haptics** — `lib/haptics.ts` тонкий шим над `WebApp.HapticFeedback`. На desktop / в браузере вне Telegram все вызовы — no-op, любая ошибка моста проглатывается. Подключено в store (toggleLetter → selectionChanged, submitWord → notify success/error/warning по типу feedback, tickTimer → impact heavy на конце игры) и во все primary CTA (Play, Buy, Apply — medium) + secondary (Back, Share, Skip, tabs — light) на Home/Result/Shop/Onboarding/Leaderboard/Game. (2) **Звуки** — `lib/sounds.ts`, WebAudio oscillator + envelope, никаких mp3. Лениво создаём AudioContext на первом playSfx (попадаем в user-gesture окно, обходим autoplay policy). 4 sfx: tap (sine 700Hz, 40ms), success (двутон 660→990Hz), fail (sawtooth 180Hz), tick (square 1100Hz, 25ms — на последних 10s). Toggle on/off в localStorage `wr.soundEnabled`, UI-кнопка под Invite friends на HomeScreen, событие `sound_toggled` в PostHog. +0.6 KB gzip. (3) **Анимации** — CSS keyframes в `index.css` (всё ≤ 250ms, prefers-reduced-motion отключает): `tile-pop` на selected LetterTile, `slide-up-fade` на новых словах в FoundWords, `screen-fade` на смену экрана через `key={screen}` wrapper в `App.ActiveScreen`. ResultScreen счёт через хук `useTickUp` — анимация от 0 до displayScore за 800ms с easeOutCubic. +0.15 KB css gzip, +0.2 KB js gzip. Всё прошло build и 35 snapshot-тестов. Server-side analytics в боте (posthog-node) уже был задеплоен в конце сессии 8 — не пересоздавали. Осталось: дизайн-проход (нужны референсы от PM) и bugfix marathon (нужны жалобы тестеров). |
| 2026-04-28 | Сессия 11. Закрыта Phase D saloon-redesign'а — 4 пункта в 4 коммита. (1) **ShopScreen redesign** в saloon-палитре: Mostaccio в позе `point` как «торговец общего магазина», секции (Replay/Themes/Boosts/Subscription) через `<Card surface="table">` + `<SaloonButton>`, brass-tinted бейджи. **Word Pro** — отдельная premium-карточка `<ProCard>` (linear-gradient leather + 1.5px brass border + радиальный glow в углу + ProBadge/корона + список бенефитов через ★, активная подписка показывает «Active · until …» pill). **Theme cards** — превью каждой темы в её собственной палитре (saloon/arcade/diner/kyoto/neo-tokyo) через inline `ThemePalette` (5 цветов: bgInner, bgOuter, border, text, glow). Pro-юзерам Apply доступен на любой теме без покупки. TabBar в футере. (2) **4 темы через design-tokens override** — переключение всей «комнаты», не только тайлов. Механика: `:root` содержит дефолтную «Saloon» палитру + composite gradients (`--gradient-page`, `--gradient-card-table`, `--gradient-tile`), которые ссылаются на basic tokens через var(). Блоки `[data-theme="arcade\|diner\|kyoto"]` переопределяют basic tokens (--bg-room/--bg-table/--bg-leather/--bg-deep/--accent-lamp/--accent-brass/--glow-pixel/--text-parchment/--tint-page) — composite gradients автоматически репэинтятся. Store маппит ThemeId → room name (`THEME_ROOM` объект в useGameStore.ts: neon→arcade, retro→diner, sakura→kyoto, cyberpunk→neoTokyo). product_id в БД и Stars-инвойсах не меняются — только клиентская трансляция при `applyThemeToDom`. Удалил legacy `--tile-*` блоки из index.css (не использовались после Phase C). Конвертировал hardcoded цвета в Card/LetterTile/всех Screens на токены: `linear-gradient(180deg, #2d1f12 0%, #1a1108 100%)` → `var(--gradient-card-table)`, `radial-gradient(circle at 38% 32%, #3a2818 0%, #0a0604 95%)` → `var(--gradient-tile)`, `0 0 0 3px #ff8c42` → `var(--accent-lamp)` в SELECTED_SHADOW тайла, `rgba(255,140,66,0.18)` page-tint во всех экранах → `var(--tint-page)`. Подиум на лидерборде: победитель теперь подсвечивается signature-цветом своей комнаты (через `var(--accent-brass-*)`), 2-3 место — `var(--bg-leather/--bg-table)`. (3) **Neo-Tokyo тема** — Akira-homage: magenta `#ff00ff` (--accent-lamp) + electric yellow `#ffff00` (--glow-pixel) на void `#0a0010` (--bg-room). В отличие от saloon-семейства тут нет warm parchment: `--text-parchment` сдвинут в pink-tinted белый `#fff0ff`, dim/ash в холодные лиловые. Glow-стэк (--glow-sm/--glow-md/--glow-lg) переопределён локально — magenta+yellow вместо amber+orange. (4) **CloudStorage onboarding**: `lib/onboarding-storage.ts` экспортирует `loadOnboardingDone(): Promise<boolean>` и `markOnboardingDone(): void`. Fallback chain: Telegram WebApp.CloudStorage (Bot API 6.9+) → localStorage `wr.onboarding.done.v1` → default false (показать). Side-effect: при чтении синк в обе стороны (если CloudStorage сказал done — пишем локально; если localStorage done а облако пусто — подтягиваем в облако). App.tsx маунтится с `onboardingPending=null` и рендерит `<BootSplash />` (заливка `var(--bg-room)`, без флэша белым) пока async-чтение не резолвится — обычно <300ms, CloudStorage callback почти мгновенный. Запись при завершении/скипе — в обе площадки (sync localStorage, fire-and-forget CloudStorage). Что не делал: PNG-export Mostaccio (нет жалоб на FPS), CRT scanlines toggle в Settings (tech-debt), npm audit fix --force (tech-debt), миграция `@telegram-apps/sdk-react`→`@tma.js/sdk-react` (tech-debt), удаление `_shared/game.ts` (tech-debt), bugfix marathon (нет жалоб тестеров). 35/35 snapshot-тестов зелёные. CSS gzip: 3.90 KB → 4.14 KB (+240 B на 3 [data-theme] блока + Neo-Tokyo) → 4.14 KB. JS gzip: 156.50 KB → 156.73 KB (+230 B на CloudStorage shim + ShopScreen новые компоненты). Saloon-redesign целиком завершён — всё 6 экранов в новом бренде. |
| 2026-04-29 | Сессия 12. Полировка к публичному запуску — 8 коммитов. (1) **fix(ui):** убраны эмоджи `🔊/🔇` (Sound · ON/OFF в pixel-типографике), `📤 Share`, `📺 Watch ad`, `📤 Invite friends`. На HomeScreen «Invite friends» из текста-ссылки в `<SaloonButton variant="secondary">` с brass-border. (2) **feat(profile) MeScreen:** новый экран `screens/MeScreen.tsx` — таб `Me` стал кликабельным. Header: Mostaccio (`pro`/`smile`) + first_name + ProBadge. Today-секция: played, replay credits, double-score, ads counter. Membership: Pro (until DATE / Free), themes (N/4 или All для Pro). Кнопки Open shop / Leaderboard. `screen: 'me'` + `showMe()` action в useGameStore. (3) **feat(profile) lifetime stats:** Edge Function `me-stats` (initData-auth, verify_jwt=false) — агрегаты по `game_sessions` юзера (best_score, total_games, days_played, current_streak, total_words_found, longest_word). `lib/api.ts: fetchMeStats`. Streak от сегодняшнего UTC-дня в прошлое, обрывается на пропуске. (4) **feat(social) share/invite + feedback:** новый `buildShareText` — 🃏/🏆/👑 по уровню score, 🟧 saloon-блок вместо purple, формат «Day N · longest: WORD», CTA «Play today’s puzzle ↓». `buildInviteText` — 🃏 saloon-vibe. `lib/day-number.ts` вынесен из HomeScreen. `lib/feedback.ts: FEEDBACK_USERNAME='ocheone95'` (placeholder). MeScreen ghost-кнопка Send feedback с deep-link на личку PM, событие `feedback_clicked`. (5) **fix(mobile):** adaptive PixelLogo `scale=4` на viewport ≤360px (iPhone SE / Galaxy Fold). `hooks/useViewportWidth.ts`. `pointerEvents: 'none'` в PixelSprite + PixelLogo — декоративные спрайты не перекрывают тапы Card на shrink. (6) **feat(brand) bot avatar:** `scripts/generate-bot-avatar.mjs` — Node-скрипт через `@resvg/resvg-js` рендерит 512×512 PNG. Mostaccio `proud` centered, warm amber radial bg, brass border ring. `apps/miniapp/public/bot-avatar.png` готов, `npm run build:bot-avatar`. PM сам грузит в @BotFather. (7) **chore audit-fix через npm overrides:** в `package.json` блок `overrides` для `@telegram-apps/transformers` и `@telegram-apps/bridge` подменяет `valibot@1.0.0` на `1.3.1` (закрывает GHSA-vqpr-j7v3-hqw9 ReDoS). `--force` хотел downgrade SDK до 2.x — обошли. Остальные 9 audit findings — `@vercel/node` build-time deps. (8) **refactor _shared/game.ts:** дубль из 135 строк → 7-строчный re-export из `../../../packages/shared/src/index.ts`. В shared `.js` extensions заменены на `.ts` (allowImportingTsExtensions=true), `isComposableFrom` переехал из дубля в `packages/shared/src/scoring.ts`. Supabase CLI deploy submit-score автоматически поднимает packages/shared/src в bundle (5 ассетов). Smoke-test прода: `invalid_body 400` — bundler runtime жив. **Edge Functions деплои за сессию:** `me-stats` (новая), `submit-score` (новый bundle path). 35/35 snapshot-тестов зелёные на каждом шаге. Saloon-redesign + бренд завершены целиком, остаётся только closed beta + публикация. |
| 2026-04-28 | Сессия 7. Закрыли Неделю 4 целиком. (1) **Shop-экран** — каркас `ShopScreen.tsx` + кнопка «Shop» на HomeScreen, секции Replay / Themes / Boosts / Subscription. (2) **Темы букв** (4 шт. × 100 ⭐): миграция 0006 `grant_theme` — атомарный insert в `purchases` + `user_themes`. Бот: универсальный `sendProductInvoice(productId)`, команды `/buy_theme_<id>` и deep-link `buy_theme_<id>` через единый `isProductId()` парсер. CSS-переменные `--tile-*` в `index.css`, LetterTile рендерит `style={{ background: 'var(--tile-bg-selected)', ... }}`. Активная тема в Zustand с persistence в localStorage, применяется через `<html data-theme>`. ShopScreen рисует превью каждой темы и кнопки Buy/Apply. (3) **Double Score** (200 ⭐): миграция 0007 — колонка `users.double_score_date`, RPC `grant_double_score` + drop+create `insert_game_session` с расширенным return (`score_applied`, `double_score_used`). Boost потребляется атомарно `WITH consumed AS (UPDATE ... RETURNING)` — при no_replay не сгорает. submit-score возвращает `score_applied`, ResultScreen показывает доумноженный счёт + бейдж «×2 boost applied», GameScreen — «×2 boost» в шапке. (4) **Word Pro** (150 ⭐/мес): миграция 0008 — partial unique index `subscriptions(user_id) where tier='pro'`, helper `is_pro_active(uuid)`, RPC `grant_pro_subscription` (продление = `greatest(now, existing) + period`). `insert_game_session` пересобран ещё раз — Pro юзер обходит rate-limit и не списывает replay credits, но boost ×2 потребляется как обычно. today-status возвращает `proActive`/`proExpiresAt`, темы для Pro union'ятся со всеми 4. HomeScreen рисует «⭐ Word Pro · until …» бейдж, ResultScreen и Shop — кнопки/состояния. (5) **Monetag rewarded ads** — каркас: миграция 0009 (колонки `users.ads_watched_date/count` + RPC `record_ad_watch` с дневным лимитом), Edge Function `record-ad-reward`, `lib/monetag.ts` (lazy-load `https://libtl.com/sdk.js?zone=<id>`, `show_<id>()` колбэк), кнопка «📺 Watch ad · +30s (N left)» на GameScreen — невидима без `VITE_MONETAG_ZONE_ID`. PM осталось зарегистрироваться в Monetag и положить zone в env. (6) Все 4 миграции и 1 новая Edge Function ждут деплоя на прод — выкатывает PM руками. Расширили today-status пятью новыми полями (themes, doubleScoreActive, proActive/expiresAt, adsWatchedToday/maxPerDay) — функция стала тяжёлой, но всё ещё один Promise.all из четырёх запросов. |

---

> **Last note:** Этот документ — живой. Когда что-то меняется в стратегии или архитектуре — обновляй его. Это единый источник правды для тебя (Claude) и для меня (PM) в любой момент времени.
