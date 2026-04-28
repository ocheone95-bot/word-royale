-- Word Royale — миграция №13: награда referrer'у за подтверждённого друга.
-- Накатывается через Supabase Studio: SQL Editor → New query → paste → Run.
--
-- Логика:
-- 1) Друг переходит по реф-ссылке → record-referral создаёт запись в
--    referrals (referrer_id, referred_id) со reward_given=false.
-- 2) Друг впервые завершает игру → submit-score после успеха зовёт
--    grant_referral_reward(p_referred_user_id) — это атомарно проверяет
--    флаг reward_given, начисляет referrer'у +REWARD_CREDITS replay-токенов
--    и помечает реферал «оплаченным».
-- 3) Идемпотентно: если уже granted — функция ничего не делает.

create or replace function public.grant_referral_reward(
  p_referred_user_id uuid,
  p_reward_credits int default 1
)
returns table (granted boolean, referrer_id uuid, credits_added int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
begin
  if p_reward_credits is null or p_reward_credits <= 0 then
    raise exception 'reward_credits must be positive';
  end if;

  -- Атомарно: помечаем referral как оплаченный, забираем referrer_id.
  -- Если уже reward_given=true или записи нет — UPDATE не цепляет ничего.
  update public.referrals
    set reward_given = true
    where referred_id = p_referred_user_id
      and reward_given = false
    returning referrer_id into v_referrer_id;

  if v_referrer_id is null then
    return query select false, null::uuid, 0;
    return;
  end if;

  -- Начисляем кредиты referrer'у.
  update public.users
    set replay_credits = replay_credits + p_reward_credits
    where id = v_referrer_id;

  return query select true, v_referrer_id, p_reward_credits;
end;
$$;

revoke all on function public.grant_referral_reward(uuid, int) from public;
revoke all on function public.grant_referral_reward(uuid, int) from anon, authenticated;
grant execute on function public.grant_referral_reward(uuid, int) to service_role;
