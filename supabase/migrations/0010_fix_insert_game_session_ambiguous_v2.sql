-- Word Royale — миграция №10: фикс рецидива «column reference was_replay is ambiguous».
-- Накатывается через Supabase Studio: SQL Editor → New query → paste → Run.
--
-- В миграциях 0007 и 0008 функция insert_game_session была пересоздана с
-- расширенным RETURNS TABLE (добавлены score_applied, double_score_used).
-- При этом качевая правка из 0005 (квалифицировать колонку
-- game_sessions.was_replay) не была перенесена — снова конфликт с одноимённым
-- return-параметром was_replay. Любая попытка submit-score вызывает
-- session_insert_failed.
--
-- Эта миграция пересоздаёт функцию ещё раз с теми же сигнатурой и логикой,
-- но с qualifier'ами на ВСЕХ ссылках на колонки таблиц, которые конфликтуют
-- с return-параметрами (was_replay, score, replay_credits_left и т.п. — для
-- надёжности квалифицируем все).

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
    select u.replay_credits into v_credits_remaining
      from public.users u where u.id = p_user_id;
  else
    select count(*) into v_existing_count
      from public.game_sessions gs
      where gs.user_id = p_user_id
        and gs.daily_seed = p_daily_seed
        and gs.was_replay = false;

    if v_existing_count = 0 then
      v_was_replay := false;
      select u.replay_credits into v_credits_remaining
        from public.users u where u.id = p_user_id;
    else
      update public.users u
        set replay_credits = u.replay_credits - 1
        where u.id = p_user_id and u.replay_credits >= 1
        returning u.replay_credits into v_credits_remaining;
      if not found then
        return query select null::uuid, null::boolean, null::int, 'no_replay'::text, null::int, null::boolean;
        return;
      end if;
      v_was_replay := true;
    end if;
  end if;

  with consumed as (
    update public.users u
      set double_score_date = null
      where u.id = p_user_id and u.double_score_date = p_daily_seed
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
