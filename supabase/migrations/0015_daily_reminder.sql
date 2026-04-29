-- Word Royale — миграция №15: daily reminder push.
-- Накатывается через `npx supabase db push`.
--
-- Retention-фича #2 из roadmap'а сессии 13: бот раз в час шлёт напоминания
-- юзерам, у которых сейчас 09:00 локально и они ещё не играли сегодня.
-- Без push-нудилки 60% юзеров забывают вернуться. Без D7 нет ни ARPU
-- ни виральности.
--
-- Архитектура:
--   1) Vercel Cron Job (apps/bot/api/cron/reminder.ts, schedule '0 * * * *')
--      → POST на Edge Function `daily-reminder` с Authorization: Bearer CRON_SECRET.
--   2) daily-reminder зовёт RPC list_users_for_reminder() — выбирает юзеров.
--   3) Шлёт sendMessage через Bot API, помечает last_reminder_sent_date в users.
--
-- Новые колонки в users:
--   - tz_offset_min: минуты от UTC (положительные для Восточных, +180 = Москва).
--     Заполняется при submit-score из new Date().getTimezoneOffset() * -1.
--     null → юзера не будим, пока не сыграет хотя бы раз (первая игра калибрует).
--   - last_reminder_sent_date: дата последнего успешно доставленного напоминания
--     (по локальному tz юзера). Идемпотентность: один push в день максимум.
--   - notifications_enabled: boolean, default true. /notifications_off в боте
--     ставит false; /notifications_on возвращает.

alter table public.users
  add column if not exists tz_offset_min int,
  add column if not exists last_reminder_sent_date date,
  add column if not exists notifications_enabled boolean not null default true;

-- Индекс под фильтр reminder-выборки: только активные подписчики с tz.
-- partial index экономит место — большинство юзеров пройдут оба условия.
create index if not exists idx_users_reminder_lookup
  on public.users (last_active_at, last_reminder_sent_date, last_played_date)
  where notifications_enabled = true and tz_offset_min is not null;

-- list_users_for_reminder: выбирает юзеров, которым прямо сейчас нужно
-- отправить напоминание. Логика «час совпал» работает по тому факту, что
-- cron триггерит функцию ровно в начале каждого часа UTC — local_hour=9
-- значит у юзера сейчас 09:00 (±5 минут на лаги cron'а). Если cron сместится,
-- юзер получит напоминание час позже.
--
-- Условия:
--   - notifications_enabled и tz_offset_min не null
--   - локальный час сейчас = 9
--   - last_reminder_sent_date != локальное «сегодня» юзера (или null) —
--     не дубль за день
--   - last_played_date != локальное «сегодня» юзера (или null) —
--     не дёргаем тех, кто уже сыграл
--   - last_active_at > now - 30 дней — не будим заброшенных
create or replace function public.list_users_for_reminder()
returns table (
  id uuid,
  telegram_id bigint,
  current_streak int,
  local_today date
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
  select id, telegram_id, current_streak, local_today
  from local_now
  where local_hour = 9
    and (last_reminder_sent_date is null or last_reminder_sent_date != local_today)
    and (last_played_date is null or last_played_date != local_today);
$$;

revoke all on function public.list_users_for_reminder() from public;
revoke all on function public.list_users_for_reminder() from anon, authenticated;
grant execute on function public.list_users_for_reminder() to service_role;

-- mark_reminder_sent: атомарно помечает что юзеру отправили напоминание сегодня.
-- Идемпотентно через date-сравнение: если за час cron перестрелил дважды —
-- второй вызов не записывает запись повторно (хотя bot уже отправил оба).
create or replace function public.mark_reminder_sent(
  p_user_id uuid,
  p_local_today date
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.users
    set last_reminder_sent_date = p_local_today
    where id = p_user_id;
$$;

revoke all on function public.mark_reminder_sent(uuid, date) from public;
revoke all on function public.mark_reminder_sent(uuid, date) from anon, authenticated;
grant execute on function public.mark_reminder_sent(uuid, date) to service_role;

-- set_notifications_enabled: вызывается из бота на /notifications_on/off.
-- Принимает telegram_id (бот не знает uuid юзера напрямую).
create or replace function public.set_notifications_enabled(
  p_telegram_id bigint,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.users
    set notifications_enabled = p_enabled
    where telegram_id = p_telegram_id;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.set_notifications_enabled(bigint, boolean) from public;
revoke all on function public.set_notifications_enabled(bigint, boolean) from anon, authenticated;
grant execute on function public.set_notifications_enabled(bigint, boolean) to service_role;
