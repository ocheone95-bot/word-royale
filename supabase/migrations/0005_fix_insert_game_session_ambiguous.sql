-- Word Royale — миграция №5: фикс ambiguous column в insert_game_session.
-- Накатывается через Supabase Studio: SQL Editor → New query → paste → Run.
--
-- Проблема: в 0004 RETURNS TABLE объявляет out-колонку `was_replay boolean`,
-- а внутри функции мы фильтруем `game_sessions.was_replay = false` без алиаса.
-- PG поднимает 42702 «column reference was_replay is ambiguous». Тест на проде
-- через RPC сразу показал ошибку — функция не выполнялась НИ РАЗУ успешно,
-- любой submit-score возвращал session_insert_failed.
--
-- Фикс: добавили алиас `gs` к game_sessions в SELECT count() и квалифицируем
-- колонку через `gs.was_replay`. INSERT-блок не страдает (там was_replay —
-- имя колонки в INSERT column list, контекст однозначный).

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
    from public.game_sessions gs
    where gs.user_id = p_user_id
      and gs.daily_seed = p_daily_seed
      and gs.was_replay = false;

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
