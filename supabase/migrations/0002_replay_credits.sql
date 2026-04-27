-- Word Royale — миграция №2: replay-токены за Telegram Stars.
-- Накатывается через Supabase Studio: SQL Editor → New query → paste → Run.
-- RLS наследуется с 0001_init.sql, новые таблицы здесь не создаются.

-- ===== Replay-credits =====
-- Счётчик купленных и неиспользованных replay-попыток у юзера.
-- +1 в bot webhook на successful_payment с product_id='replay'.
-- -1 в Edge Function submit-score, когда юзер играет 2-й раз за день.
alter table public.users
  add column if not exists replay_credits int not null default 0
  check (replay_credits >= 0);

-- ===== Метка повторной сессии =====
-- Сессия с was_replay=true потратила replay-токен.
-- Используется submit-score: если у юзера уже есть сессия с was_replay=false
-- на сегодня, новая сессия требует токена и помечается was_replay=true.
alter table public.game_sessions
  add column if not exists was_replay boolean not null default false;
