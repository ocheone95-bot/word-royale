-- Word Royale — миграция №7: Double Score boost (200 ⭐).
-- Накатывается через Supabase Studio: SQL Editor → New query → paste → Run.
--
-- Содержит:
--   1. колонку users.double_score_date date — день, на который куплен буст;
--      NULL = не активен. Выражение active = (double_score_date = current_date).
--   2. функцию grant_double_score — атомарное начисление по аналогии с
--      grant_replay_credit / grant_theme. Idempotent по telegram_payment_id.
--   3. новую сигнатуру insert_game_session — возвращает реально записанный
--      score (с учётом ×2) и флаг double_score_used. Boost применяется ровно
--      один раз и сбрасывается в той же транзакции.

-- 1. Колонка
alter table public.users
  add column if not exists double_score_date date;

-- 2. Grant
create or replace function public.grant_double_score(
  p_telegram_id bigint,
  p_username text,
  p_first_name text,
  p_telegram_payment_id text,
  p_stars_amount int
)
returns table (user_id uuid, was_new boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_inserted_id uuid;
begin
  insert into public.users (telegram_id, username, first_name)
  values (p_telegram_id, p_username, p_first_name)
  on conflict (telegram_id) do update
    set last_active_at = now(),
        username = coalesce(excluded.username, public.users.username),
        first_name = coalesce(excluded.first_name, public.users.first_name)
  returning id into v_user_id;

  insert into public.purchases (user_id, product_id, stars_amount, telegram_payment_id)
  values (v_user_id, 'double_score', p_stars_amount, p_telegram_payment_id)
  on conflict (telegram_payment_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is not null then
    -- Двойной буст не складывается: повторная покупка перезатрёт дату.
    update public.users
      set double_score_date = current_date
      where id = v_user_id;
    return query select v_user_id, true;
  else
    return query select v_user_id, false;
  end if;
end;
$$;

revoke all on function public.grant_double_score(bigint, text, text, text, int) from public;
revoke all on function public.grant_double_score(bigint, text, text, text, int) from anon, authenticated;
grant execute on function public.grant_double_score(bigint, text, text, text, int) to service_role;

-- 3. insert_game_session — return type меняется, поэтому drop + create.
drop function if exists public.insert_game_session(uuid, date, text, int, text[], int);

create function public.insert_game_session(
  p_user_id uuid,
  p_daily_seed date,
  p_letters text,
  p_score int,
  p_words_found text[],
  p_duration_sec int
)
returns table (
  session_id uuid,
  was_replay boolean,
  replay_credits_left int,
  result_code text,
  score_applied int,
  double_score_used boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_count int;
  v_was_replay boolean;
  v_inserted_id uuid;
  v_credits_remaining int;
  v_double_used boolean := false;
  v_score_applied int;
  v_double_was_set int;
begin
  select count(*) into v_existing_count
    from public.game_sessions
    where user_id = p_user_id
      and daily_seed = p_daily_seed
      and was_replay = false;

  if v_existing_count = 0 then
    v_was_replay := false;
    select replay_credits into v_credits_remaining
      from public.users where id = p_user_id;
  else
    update public.users
      set replay_credits = replay_credits - 1
      where id = p_user_id and replay_credits >= 1
      returning replay_credits into v_credits_remaining;
    if not found then
      return query select null::uuid, null::boolean, null::int, 'no_replay'::text, null::int, null::boolean;
      return;
    end if;
    v_was_replay := true;
  end if;

  -- Boost потребляется атомарно: сбрасываем double_score_date только если он
  -- активен (= p_daily_seed). Если активен — удваиваем score, иначе пишем как есть.
  with consumed as (
    update public.users
      set double_score_date = null
      where id = p_user_id and double_score_date = p_daily_seed
      returning 1
  )
  select count(*) into v_double_was_set from consumed;
  if v_double_was_set > 0 then
    v_double_used := true;
    v_score_applied := p_score * 2;
  else
    v_score_applied := p_score;
  end if;

  insert into public.game_sessions (
    user_id, daily_seed, letters, score, words_found, duration_sec, was_replay
  ) values (
    p_user_id, p_daily_seed, p_letters, v_score_applied, p_words_found, p_duration_sec, v_was_replay
  )
  returning id into v_inserted_id;

  return query select
    v_inserted_id,
    v_was_replay,
    v_credits_remaining,
    'ok'::text,
    v_score_applied,
    v_double_used;
end;
$$;

revoke all on function public.insert_game_session(uuid, date, text, int, text[], int) from public;
revoke all on function public.insert_game_session(uuid, date, text, int, text[], int) from anon, authenticated;
grant execute on function public.insert_game_session(uuid, date, text, int, text[], int) to service_role;
