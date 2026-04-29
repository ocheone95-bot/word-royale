-- Word Royale — миграция №16: Pro free trial после 3-й партии.
-- Накатывается через `npx supabase db push`.
--
-- Retention-фича #1 из roadmap'а сессии 13: после 3 уникальных дней игры юзер
-- автоматически получает 1 день Word Pro бесплатно (безлимит + все темы).
-- Цель: trial→paid конверсия 5-10% против cold 0.5-1%. Дешевле, чем lower
-- pricing — даём почувствовать ценность.
--
-- Решения:
-- 1) Per-lifetime: один trial за всё время, флаг через `users.pro_trial_granted_at`.
--    Если юзер уже получал — больше не получит, даже если сломал серию и сыграл
--    ещё 3 дня заново.
-- 2) Trial реализован как обычная запись в `subscriptions` с tier='pro', stars_amount=0.
--    Это позволяет переиспользовать `is_pro_active` без специальной логики.
--    Различение trial vs paid делается через колонку `users.pro_trial_granted_at`
--    (если время grant + 24h ещё не прошло AND нет paid purchase — это trial).
-- 3) Не выдаём trial если у юзера уже активен Pro (paid или streak-30 reward).
--    Помечаем `pro_trial_granted_at`, чтобы trial не висел в очереди и не выдался
--    позже когда подписка истечёт. Простой MVP — если PM захочет «дать trial
--    после ухода с paid», переделаем по фидбеку.

alter table public.users
  add column if not exists pro_trial_granted_at timestamptz;

-- try_grant_pro_trial: вызывается из submit-score после успешной не-replay сессии.
-- Атомарно: считает уникальные дни, проверяет idempotency, выдаёт trial если все
-- условия выполнены. Возвращает (granted, expires_at).
--
-- Условия выдачи (все):
--   - pro_trial_granted_at IS NULL (никогда не получал)
--   - count(distinct daily_seed) where was_replay=false >= 3
--   - не активен Pro (paid или другой источник)
--
-- Если первые два выполнены, но юзер уже Pro — помечаем pro_trial_granted_at=now,
-- но subscription не трогаем. Это «израсходовало» trial-возможность на будущее.
create or replace function public.try_grant_pro_trial(
  p_user_id uuid
)
returns table (granted boolean, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_already boolean;
  v_unique_days int;
  v_new_expires timestamptz;
begin
  select pro_trial_granted_at is not null into v_already
    from public.users where id = p_user_id;
  if v_already then
    return query select false, null::timestamptz;
    return;
  end if;

  select count(distinct daily_seed)::int into v_unique_days
    from public.game_sessions
    where user_id = p_user_id and was_replay = false;

  if v_unique_days < 3 then
    return query select false, null::timestamptz;
    return;
  end if;

  -- Юзер уже Pro (paid / streak 30d) — trial не нужен. Помечаем чтобы не
  -- выдать позже после истечения подписки. Если PM захочет иначе — снять
  -- эту строчку и trial выдастся, когда юзер «упадёт» с Pro.
  if public.is_pro_active(p_user_id) then
    update public.users set pro_trial_granted_at = now() where id = p_user_id;
    return query select false, null::timestamptz;
    return;
  end if;

  v_new_expires := now() + interval '1 day';

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

  update public.users
    set pro_trial_granted_at = now()
    where id = p_user_id;

  return query select true, v_new_expires;
end;
$$;

revoke all on function public.try_grant_pro_trial(uuid) from public;
revoke all on function public.try_grant_pro_trial(uuid) from anon, authenticated;
grant execute on function public.try_grant_pro_trial(uuid) to service_role;
