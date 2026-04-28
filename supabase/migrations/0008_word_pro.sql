-- Word Royale — миграция №8: Word Pro подписка (150 ⭐ / месяц).
-- Накатывается через Supabase Studio: SQL Editor → New query → paste → Run.
--
-- Telegram Stars НЕ имеют автоматических автоплатежей: каждый месяц юзер
-- платит руками. Поэтому подписка моделируется как одна строка на юзера
-- (партиал-уник по (user_id, tier='pro')) с expires_at — payment продлевает
-- срок: max(now, existing.expires_at) + 30 days. Status переключается в
-- 'expired' лениво — на чтении (is_pro_active checks expires_at > now).
--
-- Содержит:
--   1. partial unique index, чтобы UPSERT по (user_id, tier='pro') работал
--   2. is_pro_active(uuid) — helper-функция
--   3. grant_pro_subscription RPC — атомарное продление/создание
--   4. новую сигнатуру insert_game_session — Pro обходит rate-limit и не
--      списывает replay_credits

create unique index if not exists ux_subscriptions_user_pro
  on public.subscriptions(user_id)
  where tier = 'pro';

create or replace function public.is_pro_active(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.subscriptions
    where user_id = p_user_id
      and tier = 'pro'
      and status = 'active'
      and expires_at > now()
  );
$$;

revoke all on function public.is_pro_active(uuid) from public;
revoke all on function public.is_pro_active(uuid) from anon, authenticated;
grant execute on function public.is_pro_active(uuid) to service_role;

create or replace function public.grant_pro_subscription(
  p_telegram_id bigint,
  p_username text,
  p_first_name text,
  p_telegram_payment_id text,
  p_stars_amount int,
  p_period_days int default 30
)
returns table (user_id uuid, was_new boolean, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_inserted_id uuid;
  v_expires_at timestamptz;
  v_existing_expires timestamptz;
begin
  if p_period_days is null or p_period_days <= 0 then
    raise exception 'period_days must be positive';
  end if;

  insert into public.users (telegram_id, username, first_name)
  values (p_telegram_id, p_username, p_first_name)
  on conflict (telegram_id) do update
    set last_active_at = now(),
        username = coalesce(excluded.username, public.users.username),
        first_name = coalesce(excluded.first_name, public.users.first_name)
  returning id into v_user_id;

  insert into public.purchases (user_id, product_id, stars_amount, telegram_payment_id)
  values (v_user_id, 'pro_subscription', p_stars_amount, p_telegram_payment_id)
  on conflict (telegram_payment_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    -- Дубль вебхука. Возвращаем текущий expires_at для контекста, was_new=false.
    select expires_at into v_expires_at
      from public.subscriptions
      where user_id = v_user_id and tier = 'pro';
    return query select v_user_id, false, v_expires_at;
    return;
  end if;

  -- Продлеваем от max(now, существующий expires_at). Новая подписка =
  -- now() + period; продление поверх активной = +period к существующему.
  select s.expires_at into v_existing_expires
    from public.subscriptions s
    where s.user_id = v_user_id and s.tier = 'pro';

  v_expires_at :=
    greatest(coalesce(v_existing_expires, now()), now())
    + (p_period_days || ' days')::interval;

  insert into public.subscriptions (
    user_id, tier, status, starts_at, expires_at,
    telegram_payment_id, stars_amount
  )
  values (
    v_user_id, 'pro', 'active', now(), v_expires_at,
    p_telegram_payment_id, p_stars_amount
  )
  on conflict (user_id) where tier = 'pro' do update
    set status = 'active',
        starts_at = least(public.subscriptions.starts_at, excluded.starts_at),
        expires_at = excluded.expires_at,
        telegram_payment_id = excluded.telegram_payment_id,
        stars_amount = excluded.stars_amount;

  return query select v_user_id, true, v_expires_at;
end;
$$;

revoke all on function public.grant_pro_subscription(bigint, text, text, text, int, int) from public;
revoke all on function public.grant_pro_subscription(bigint, text, text, text, int, int) from anon, authenticated;
grant execute on function public.grant_pro_subscription(bigint, text, text, text, int, int) to service_role;

-- insert_game_session: Pro обходит rate-limit и не списывает replay_credits.
-- Сигнатура совпадает с 0007.
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
  v_is_pro boolean;
begin
  v_is_pro := public.is_pro_active(p_user_id);

  if v_is_pro then
    -- Pro: ни счётчика игр, ни расхода кредитов. Все игры идут как
    -- was_replay=false (это полноценная игра, не replay-выкуп).
    v_was_replay := false;
    select replay_credits into v_credits_remaining
      from public.users where id = p_user_id;
  else
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
  end if;

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
