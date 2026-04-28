-- Word Royale — миграция №11: rewarded ad даёт +1 replay_credit, не +30s.
-- Накатывается через Supabase Studio: SQL Editor → New query → paste → Run.
--
-- В сессии 7 PM дал фидбек: реклама должна предлагаться ПОСЛЕ игры как
-- бесплатная альтернатива покупке replay, а не во время игры как +30 сек.
--
-- Эта миграция пересоздаёт record_ad_watch так, что при allowed=true она
-- атомарно:
--   1. инкрементит users.ads_watched_count (анти-чит остаётся)
--   2. инкрементит users.replay_credits на +1
--   3. возвращает обновлённый replay_credits, чтобы клиент сразу знал статус
-- Если лимит исчерпан — replay_credits не трогает, allowed=false.

drop function if exists public.record_ad_watch(uuid, int);

create function public.record_ad_watch(
  p_user_id uuid,
  p_max_per_day int
)
returns table (
  allowed boolean,
  watched_today int,
  max_per_day int,
  replay_credits int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
  v_count int;
  v_credits int;
begin
  if p_max_per_day is null or p_max_per_day <= 0 then
    raise exception 'max_per_day must be positive';
  end if;

  update public.users u
    set
      ads_watched_count = case
        when u.ads_watched_date = v_today then u.ads_watched_count + 1
        else 1
      end,
      ads_watched_date = v_today,
      replay_credits = u.replay_credits + 1
    where u.id = p_user_id
      and (u.ads_watched_date <> v_today or u.ads_watched_count < p_max_per_day)
    returning u.ads_watched_count, u.replay_credits into v_count, v_credits;

  if not found then
    -- Лимит исчерпан — счётчики не меняем, replay-кредит не выдаём.
    select u.ads_watched_count, u.replay_credits into v_count, v_credits
      from public.users u where u.id = p_user_id;
    return query select false, coalesce(v_count, 0), p_max_per_day, coalesce(v_credits, 0);
    return;
  end if;

  return query select true, v_count, p_max_per_day, v_credits;
end;
$$;

revoke all on function public.record_ad_watch(uuid, int) from public;
revoke all on function public.record_ad_watch(uuid, int) from anon, authenticated;
grant execute on function public.record_ad_watch(uuid, int) to service_role;
