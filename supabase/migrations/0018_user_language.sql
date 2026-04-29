-- Word Royale — миграция №18: язык интерфейса юзера.
-- Накатывается через `npx supabase db push`.
--
-- Retention-фича #5 из roadmap'а сессии 13: RU-локализация. ~70% TG-органики
-- — RU/UA/BY/KZ. Без локализации ARPU режется в 2x.
--
-- Колонка `users.language_code` хранит выбранный язык — 'en' | 'ru'.
-- Mini App шлёт значение в submit-score (на первой партии — auto-detect по
-- Telegram language_code, потом — ручной toggle в MeScreen). Бот и Edge
-- Functions (daily-reminder, weekly-prize-distribution) читают колонку,
-- чтобы слать сообщения на правильном языке.
--
-- Default 'en' — нейтральный fallback. RU-юзер на первой submit-score
-- сразу перейдёт на свой язык; пока он не сыграл — auto-detect работает
-- только в Mini App (через Telegram WebApp.initDataUnsafe.user.language_code).

alter table public.users
  add column if not exists language_code text not null default 'en'
    check (language_code in ('en', 'ru'));

-- Расширяем list_users_for_reminder, чтобы он возвращал language_code —
-- daily-reminder выберет правильный текст из STRINGS_RU/EN. Логика выборки
-- идентична 0015, добавлено только поле language_code в RETURNS TABLE.
drop function if exists public.list_users_for_reminder();

create function public.list_users_for_reminder()
returns table (
  id uuid,
  telegram_id bigint,
  current_streak int,
  local_today date,
  language_code text
)
language sql
security definer
set search_path = public
as $$
  with local_now as (
    select
      u.id,
      u.telegram_id,
      u.current_streak,
      u.language_code,
      ((now() at time zone 'UTC') + (u.tz_offset_min || ' minutes')::interval)::date as local_today,
      extract(hour from
        (now() at time zone 'UTC') + (u.tz_offset_min || ' minutes')::interval
      )::int as local_hour,
      u.last_reminder_sent_date,
      u.last_played_date
    from public.users u
    where u.notifications_enabled = true
      and u.tz_offset_min is not null
      and u.last_active_at > now() - interval '30 days'
  )
  select id, telegram_id, current_streak, local_today, language_code
  from local_now
  where local_hour = 9
    and (last_reminder_sent_date is null or last_reminder_sent_date != local_today)
    and (last_played_date is null or last_played_date != local_today);
$$;

revoke all on function public.list_users_for_reminder() from public;
revoke all on function public.list_users_for_reminder() from anon, authenticated;
grant execute on function public.list_users_for_reminder() to service_role;

-- list_weekly_prize_recipients возвращает language_code (миграция 0017 ставила
-- здесь null). Перевыпуск с реальным значением для DM-локализации.
create or replace function public.list_weekly_prize_recipients(
  p_week_start date
)
returns table (
  user_id uuid,
  telegram_id bigint,
  language_code text,
  rank int,
  prize_type text,
  first_name text
)
language sql
security definer
set search_path = public
as $$
  select
    g.user_id,
    u.telegram_id,
    u.language_code,
    g.rank,
    g.prize_type,
    u.first_name
  from public.weekly_prize_grants g
  join public.users u on u.id = g.user_id
  where g.week_start = p_week_start
  order by g.rank asc;
$$;

revoke all on function public.list_weekly_prize_recipients(date) from public;
revoke all on function public.list_weekly_prize_recipients(date) from anon, authenticated;
grant execute on function public.list_weekly_prize_recipients(date) to service_role;
