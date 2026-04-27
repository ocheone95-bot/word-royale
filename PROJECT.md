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
- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **Стилизация:** Tailwind CSS
- **Telegram интеграция:** `@telegram-apps/sdk-react`
- **State:** Zustand (простой, не Redux)
- **Хостинг:** Vercel (бесплатный тир)

### Backend
- **БД + Auth + Realtime:** Supabase (бесплатно до 50k MAU)
- **Edge Functions:** Supabase Edge Functions для проверки платежей и серверной логики
- **Telegram Bot:** Node.js + `grammY` библиотека
- **Хостинг бота:** Vercel Serverless Functions или Railway (бесплатный тир)

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

### Неделя 1: Фундамент
- [x] Setup репозитория, monorepo через npm workspaces
- [x] Создание React + Vite + TypeScript проекта
- [x] Регистрация бота через @BotFather
- [ ] Hello World в Telegram (Mini App открывается из бота)
- [ ] Telegram SDK интеграция, получение initData юзера
- [x] Базовый UI: главный экран с кнопкой Play
- [ ] Loading и error states

### Неделя 2: Core механика
- [ ] Загрузка английского словаря (370k слов в JSON)
- [ ] Алгоритм генерации daily seed (одинаковые буквы для всех)
- [ ] Игровой экран: 7 букв в виде тайлов
- [ ] Логика выбора букв (тап + свайп)
- [ ] Проверка слова против словаря
- [ ] Подсчёт очков
- [ ] Таймер 90 секунд
- [ ] Экран результата

### Неделя 3: Backend и социалка
- [ ] Supabase setup, миграции
- [ ] Сохранение игровых сессий
- [ ] Edge Function для валидации скора
- [ ] Глобальный лидерборд топ-100
- [ ] Friends лидерборд (через Telegram contacts)
- [ ] Кнопка Share с генерацией картинки результата
- [ ] Реферальная ссылка с трекингом

### Неделя 4: Монетизация
- [ ] Telegram Stars интеграция в бот
- [ ] Webhook на successful_payment
- [ ] Подписка Word Pro (логика проверки активной подписки)
- [ ] Микро-IAP: replay, темы, double score
- [ ] Monetag SDK для rewarded ads
- [ ] UI магазина внутри Mini App

### Неделя 5: Polish
- [ ] PostHog аналитика — все ключевые события
- [ ] Sentry error tracking
- [ ] Onboarding tutorial для новичков (3 экрана)
- [ ] 4 темы букв с CSS-эффектами
- [ ] Звуки и haptic feedback (Telegram WebApp API)
- [ ] Полировка анимаций
- [ ] Bugfix marathon

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

---

> **Last note:** Этот документ — живой. Когда что-то меняется в стратегии или архитектуре — обновляй его. Это единый источник правды для тебя (Claude) и для меня (PM) в любой момент времени.
