-- Word Royale — миграция №9: учёт rewarded ads.
-- Накатывается через Supabase Studio: SQL Editor → New query → paste → Run.
--
-- Бесплатный rewarded ad даёт +30 сек к таймеру. Чтобы юзер не зажимал просмотр
-- бесконечно, держим дневной счётчик. Колонка ads_watched_date — день, к
-- которому относится счётчик; ads_watched_count — сколько просмотров уже было.
-- При первом запросе нового дня счётчик сбрасывается и инкрементится атомарно
-- внутри record_ad_watch.

alter table public.users
  add column if not exists ads_watched_date date,
  add column if not exists ads_watched_count int not null default 0;

create or replace function public.record_ad_watch(
  p_user_id uuid,
  p_max_per_day int
)
returns table (allowed boolean, watched_today int, max_per_day int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
  v_count int;
begin
  if p_max_per_day is null or p_max_per_day <= 0 then
    raise exception 'max_per_day must be positive';
  end if;

  -- Атомарное обновление: либо инкрементим текущий счётчик дня, либо сбрасываем.
  update public.users
    set
      ads_watched_count = case
        when ads_watched_date = v_today then ads_watched_count + 1
        else 1
      end,
      ads_watched_date = v_today
    where id = p_user_id
      and (ads_watched_date <> v_today or ads_watched_count < p_max_per_day)
    returning ads_watched_count into v_count;

  if not found then
    -- Не удалось инкрементить — лимит исчерпан. Возвращаем текущее значение.
    select ads_watched_count into v_count
      from public.users where id = p_user_id;
    return query select false, coalesce(v_count, 0), p_max_per_day;
    return;
  end if;

  return query select true, v_count, p_max_per_day;
end;
$$;

revoke all on function public.record_ad_watch(uuid, int) from public;
revoke all on function public.record_ad_watch(uuid, int) from anon, authenticated;
grant execute on function public.record_ad_watch(uuid, int) to service_role;
