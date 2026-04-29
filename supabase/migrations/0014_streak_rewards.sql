-- Word Royale — миграция №14: daily streak rewards.
-- Накатывается через `npx supabase db push` (или Supabase Studio при необходимости).
--
-- Retention-фича из roadmap сессии 13: «что терять» вместо «что получить».
-- Loss-aversion работает сильнее моментального reward'а, поэтому добавляем
-- ежедневную серию с тремя порогами наград:
--   3 дня  → +1 replay credit
--   7 дней → бесплатная тема (фиксированно 'neon' — самая нейтральная brass-arcade)
--   30 дней → 30 дней Word Pro в подарок (продлевает существующую подписку)
--
-- Решения по дизайну:
-- 1) Streak хранится в users (не считается на лету), потому что:
--    а) milestone-проверки идут в той же транзакции что insert_game_session,
--    б) StreakChip на каждом экране — без дополнительного запроса к game_sessions.
-- 2) Награды per-lifetime (поле last_streak_milestone_reached). Если юзер
--    сломал серию и снова дошёл до 30 — Pro повторно не выдаём. Простой MVP.
--    Если фидбек попросит — переедем на отдельную таблицу streak_rewards
--    с историей (granted_at, milestone, expires_at).
-- 3) Streak обновляется только на не-replay сессиях (was_replay=false).
--    Replay'ы куплены за Stars — не должны конвертироваться в бесплатную тему.
--    Pro юзер за день играет N раз (все was_replay=false), но streak двигается
--    только по first-of-day через сравнение last_played_date с UTC-сегодня.
-- 4) claim_streak_reward — отдельная RPC, идемпотентная по
--    last_streak_milestone_reached (UPDATE ... WHERE last < new атомарно).
--    submit-score зовёт её после успешного insert_game_session, ошибки RPC
--    не считаются фатальными для submit-score (как с grant_referral_reward).

alter table public.users
  add column if not exists current_streak int not null default 0,
  add column if not exists best_streak int not null default 0,
  add column if not exists last_played_date date,
  add column if not exists last_streak_milestone_reached int not null default 0;

create or replace function public.claim_streak_reward(
  p_user_id uuid,
  p_milestone int
)
returns table (granted boolean, reward_type text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_expires timestamptz;
  v_new_expires timestamptz;
  v_updated int;
begin
  if p_milestone is null or p_milestone not in (3, 7, 30) then
    return query select false, null::text;
    return;
  end if;

  -- Атомарный idempotency-check: апдейтим только если новый milestone больше
  -- ранее засчитанного. Если строки не нашлось — значит юзер уже получал
  -- эту (или большую) награду; ничего не делаем.
  update public.users
    set last_streak_milestone_reached = p_milestone
    where id = p_user_id
      and last_streak_milestone_reached < p_milestone;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return query select false, null::text;
    return;
  end if;

  if p_milestone = 3 then
    update public.users
      set replay_credits = replay_credits + 1
      where id = p_user_id;
    return query select true, 'replay_credit'::text;
    return;
  end if;

  if p_milestone = 7 then
    -- Награда — тема 'neon'. Если юзер уже владеет (купил или Pro), insert
    -- не дублируется через PK (user_id, theme_id).
    insert into public.user_themes (user_id, theme_id)
    values (p_user_id, 'neon')
    on conflict (user_id, theme_id) do nothing;
    return query select true, 'theme_neon'::text;
    return;
  end if;

  if p_milestone = 30 then
    -- Pro на 30 дней. Если активная подписка уже есть — продлеваем от её
    -- expires_at, иначе от now. В отличие от grant_pro_subscription,
    -- запись в purchases не создаём — это не Stars-платёж, а награда.
    select s.expires_at into v_existing_expires
      from public.subscriptions s
      where s.user_id = p_user_id and s.tier = 'pro';

    v_new_expires :=
      greatest(coalesce(v_existing_expires, now()), now())
      + interval '30 days';

    insert into public.subscriptions (
      user_id, tier, status, starts_at, expires_at, stars_amount
    )
    values (
      p_user_id, 'pro', 'active', now(), v_new_expires, 0
    )
    on conflict (user_id) where tier = 'pro' do update
      set status = 'active',
          starts_at = least(public.subscriptions.starts_at, excluded.starts_at),
          expires_at = excluded.expires_at;

    return query select true, 'pro_30d'::text;
    return;
  end if;

  return query select false, null::text;
end;
$$;

revoke all on function public.claim_streak_reward(uuid, int) from public;
revoke all on function public.claim_streak_reward(uuid, int) from anon, authenticated;
grant execute on function public.claim_streak_reward(uuid, int) to service_role;

-- insert_game_session: добавляем обновление streak и возвращаем
-- current_streak / streak_milestone_reached в результате. Сигнатура остальной
-- логики (rate-limit, replay credits, double score, Pro-bypass) сохранена.
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
  double_score_used boolean,
  current_streak int,
  streak_milestone_reached int
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
  v_today date;
  v_last_played date;
  v_curr_streak int;
  v_last_milestone int;
  v_new_streak int := 0;
  v_milestone_reached int := 0;
begin
  v_is_pro := public.is_pro_active(p_user_id);

  if v_is_pro then
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
        return query select null::uuid, null::boolean, null::int,
          'no_replay'::text, null::int, null::boolean, null::int, null::int;
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

  -- Streak: только не-replay сессии. Pro юзер за день делает несколько
  -- not-replay сессий — двигаем стрик только при первой (last_played_date != today).
  if not v_was_replay then
    v_today := (now() at time zone 'UTC')::date;
    select last_played_date, current_streak, last_streak_milestone_reached
      into v_last_played, v_curr_streak, v_last_milestone
      from public.users where id = p_user_id;

    if v_last_played is null or (v_today - v_last_played) > 1 then
      v_new_streak := 1;
    elsif (v_today - v_last_played) = 1 then
      v_new_streak := coalesce(v_curr_streak, 0) + 1;
    else
      -- v_last_played = v_today: тот же UTC-день, streak не двигается.
      v_new_streak := coalesce(v_curr_streak, 0);
    end if;

    update public.users
      set current_streak = v_new_streak,
          best_streak = greatest(best_streak, v_new_streak),
          last_played_date = v_today
      where id = p_user_id;

    -- Перешагнули порог? Берём максимальный достижимый, если их несколько
    -- (например, миграция накатилась на юзера со streak >= 30).
    if v_new_streak >= 30 and coalesce(v_last_milestone, 0) < 30 then
      v_milestone_reached := 30;
    elsif v_new_streak >= 7 and coalesce(v_last_milestone, 0) < 7 then
      v_milestone_reached := 7;
    elsif v_new_streak >= 3 and coalesce(v_last_milestone, 0) < 3 then
      v_milestone_reached := 3;
    end if;
  else
    -- Replay сессия: streak не двигаем, но возвращаем актуальное значение
    -- из БД, чтобы UI мог показать на ResultScreen.
    select current_streak into v_new_streak
      from public.users where id = p_user_id;
  end if;

  return query select
    v_inserted_id,
    v_was_replay,
    v_credits_remaining,
    'ok'::text,
    v_score_applied,
    v_double_used,
    coalesce(v_new_streak, 0),
    v_milestone_reached;
end;
$$;

revoke all on function public.insert_game_session(uuid, date, text, int, text[], int) from public;
revoke all on function public.insert_game_session(uuid, date, text, int, text[], int) from anon, authenticated;
grant execute on function public.insert_game_session(uuid, date, text, int, text[], int) to service_role;
