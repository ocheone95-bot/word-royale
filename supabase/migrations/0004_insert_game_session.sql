-- Word Royale — миграция №4: атомарная вставка сессии с rate-limit.
-- Накатывается через Supabase Studio: SQL Editor → New query → paste → Run.
--
-- Один вызов из Edge Function submit-score решает три задачи без race-condition:
--   1. Если у юзера нет non-replay сессии на сегодня — пускает бесплатно
--      (was_replay=false).
--   2. Если уже играл — пробует декрементить replay_credits (атомарно через
--      WHERE replay_credits >= 1). Если получилось — вставляет сессию с
--      was_replay=true, возвращает remaining credits.
--   3. Если уже играл и кредитов нет — возвращает result_code='no_replay',
--      сессия не вставляется. Edge Function отвечает клиенту 403.

create or replace function public.insert_game_session(
  p_user_id uuid,
  p_daily_seed date,
  p_letters text,
  p_score int,
  p_words_found text[],
  p_duration_sec int
)
returns table (session_id uuid, was_replay boolean, replay_credits_left int, result_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_count int;
  v_was_replay boolean;
  v_inserted_id uuid;
  v_credits_remaining int;
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
      return query select null::uuid, null::boolean, null::int, 'no_replay'::text;
      return;
    end if;
    v_was_replay := true;
  end if;

  insert into public.game_sessions (
    user_id, daily_seed, letters, score, words_found, duration_sec, was_replay
  ) values (
    p_user_id, p_daily_seed, p_letters, p_score, p_words_found, p_duration_sec, v_was_replay
  )
  returning id into v_inserted_id;

  return query select v_inserted_id, v_was_replay, v_credits_remaining, 'ok'::text;
end;
$$;

revoke all on function public.insert_game_session(uuid, date, text, int, text[], int) from public;
revoke all on function public.insert_game_session(uuid, date, text, int, text[], int) from anon, authenticated;
grant execute on function public.insert_game_session(uuid, date, text, int, text[], int) to service_role;
