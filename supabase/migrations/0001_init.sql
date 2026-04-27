-- Word Royale — начальная схема БД
-- Накатывается через Supabase Studio: SQL Editor → New query → paste → Run.
-- RLS включён везде. Запись только под service_role (Edge Functions).
-- Публичное чтение разрешено только на users и game_sessions (нужно для лидерборда).

-- pgcrypto нужен для gen_random_uuid()
create extension if not exists pgcrypto;

-- ===== Игроки =====
create table public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique not null,
  username text,
  first_name text,
  photo_url text,
  coins int not null default 0,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create index idx_users_telegram_id on public.users(telegram_id);

-- ===== Игровые сессии =====
-- daily_seed = дата UTC, на которую играл юзер. Скор валидирован сервером.
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  daily_seed date not null,
  letters text not null,
  score int not null check (score >= 0),
  words_found text[] not null default '{}',
  duration_sec int not null default 90,
  created_at timestamptz not null default now()
);

create index idx_game_sessions_user_date on public.game_sessions(user_id, daily_seed);
create index idx_game_sessions_daily_score on public.game_sessions(daily_seed, score desc);

-- ===== Подписки =====
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tier text not null,
  status text not null check (status in ('active', 'expired', 'cancelled')),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  telegram_payment_id text unique,
  stars_amount int not null check (stars_amount >= 0),
  created_at timestamptz not null default now()
);

create index idx_subscriptions_user_status on public.subscriptions(user_id, status);

-- ===== Микро-покупки за Stars =====
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id text not null,
  stars_amount int not null check (stars_amount >= 0),
  telegram_payment_id text unique,
  created_at timestamptz not null default now()
);

create index idx_purchases_user on public.purchases(user_id);

-- ===== Разблокированные косметические темы =====
create table public.user_themes (
  user_id uuid not null references public.users(id) on delete cascade,
  theme_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, theme_id)
);

-- ===== Реферальная программа =====
-- В MVP «друзья» = взаимные рефералы (referrer + referred).
create table public.referrals (
  referrer_id uuid not null references public.users(id) on delete cascade,
  referred_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  reward_given boolean not null default false,
  primary key (referrer_id, referred_id),
  check (referrer_id <> referred_id)
);

create index idx_referrals_referred on public.referrals(referred_id);

-- ===== Словарь для серверной валидации =====
-- Заполняется отдельным seed-скриптом из packages/dictionary.
-- Edge Function делает SELECT word = ANY($1) при валидации сессии.
create table public.dictionary_words (
  word text primary key
);

-- ===== Row Level Security =====
-- Принцип: всё закрыто, открываем точечно.
-- service_role обходит RLS автоматически — Edge Functions могут писать всё.

alter table public.users enable row level security;
alter table public.game_sessions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.purchases enable row level security;
alter table public.user_themes enable row level security;
alter table public.referrals enable row level security;
alter table public.dictionary_words enable row level security;

-- Публичное чтение игроков и сессий (нужно для лидерборда).
-- Колонки users публичны по сути (username, first_name, photo_url из Telegram).
create policy "users_select_public"
  on public.users for select
  to anon, authenticated
  using (true);

create policy "game_sessions_select_public"
  on public.game_sessions for select
  to anon, authenticated
  using (true);

-- Все остальные таблицы и операции — только service_role.
-- Отсутствие policies = deny by default для anon/authenticated.
