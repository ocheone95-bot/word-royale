-- Word Royale — миграция №19: replay-bundles (8× и 12×).
-- Накатывается через `npx supabase db push`.
--
-- Сессия 14, продолжение: новый shop-дизайн добавляет два пакета replay'ев —
-- 200⭐ за 8 (50% скидка) и 400⭐ за 12 (33% скидка). Соответствующие
-- product_ids: replay_8 и replay_12.
--
-- Расширяем grant_replay_credit чтобы принимать продукт + количество. Логика
-- та же что в 0003: upsert user, идемпотентный insert в purchases, инкремент
-- replay_credits на p_qty (вместо хардкода +1).
--
-- revoke_purchase (миграция 0012) расширен на replay_8 / replay_12 case.

drop function if exists public.grant_replay_credit(bigint, text, text, text, int);

create function public.grant_replay_credit(
  p_telegram_id bigint,
  p_username text,
  p_first_name text,
  p_telegram_payment_id text,
  p_stars_amount int,
  p_product_id text default 'replay',
  p_qty int default 1
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
  if p_qty < 1 or p_qty > 100 then
    raise exception 'invalid_qty';
  end if;
  if p_product_id not in ('replay', 'replay_8', 'replay_12') then
    raise exception 'invalid_product';
  end if;

  insert into public.users (telegram_id, username, first_name)
  values (p_telegram_id, p_username, p_first_name)
  on conflict (telegram_id) do update
    set last_active_at = now(),
        username = coalesce(excluded.username, public.users.username),
        first_name = coalesce(excluded.first_name, public.users.first_name)
  returning id into v_user_id;

  insert into public.purchases (user_id, product_id, stars_amount, telegram_payment_id)
  values (v_user_id, p_product_id, p_stars_amount, p_telegram_payment_id)
  on conflict (telegram_payment_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is not null then
    update public.users
      set replay_credits = replay_credits + p_qty
      where id = v_user_id;
    return query select v_user_id, true;
  else
    return query select v_user_id, false;
  end if;
end;
$$;

revoke all on function public.grant_replay_credit(bigint, text, text, text, int, text, int) from public;
revoke all on function public.grant_replay_credit(bigint, text, text, text, int, text, int) from anon, authenticated;
grant execute on function public.grant_replay_credit(bigint, text, text, text, int, text, int) to service_role;

-- revoke_purchase: минимальный delta — добавляем case-ы для replay_8 / replay_12
-- (8 и 12 кредитов соответственно), остальная логика из 0012 не меняется.
create or replace function public.revoke_purchase(
  p_telegram_payment_id text,
  p_telegram_user_id bigint
)
returns table (
  ok boolean,
  product_id text,
  was_already_refunded boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_user_id uuid;
  v_product_id text;
  v_already boolean;
  v_theme_id text;
  v_actual_tg_id bigint;
begin
  select p.id, p.user_id, p.product_id, p.refunded
    into v_purchase_id, v_user_id, v_product_id, v_already
    from public.purchases p
    where p.telegram_payment_id = p_telegram_payment_id;

  if v_purchase_id is null then
    return query select false, null::text, false;
    return;
  end if;

  select telegram_id into v_actual_tg_id
    from public.users where id = v_user_id;

  if v_actual_tg_id is null or v_actual_tg_id <> p_telegram_user_id then
    return query select false, v_product_id, v_already;
    return;
  end if;

  if v_already then
    return query select true, v_product_id, true;
    return;
  end if;

  if v_product_id = 'replay' then
    update public.users
      set replay_credits = greatest(replay_credits - 1, 0)
      where id = v_user_id;
  elsif v_product_id = 'replay_8' then
    update public.users
      set replay_credits = greatest(replay_credits - 8, 0)
      where id = v_user_id;
  elsif v_product_id = 'replay_12' then
    update public.users
      set replay_credits = greatest(replay_credits - 12, 0)
      where id = v_user_id;
  elsif v_product_id = 'double_score' then
    update public.users
      set double_score_date = null
      where id = v_user_id;
  elsif v_product_id = 'pro_subscription' then
    update public.subscriptions
      set status = 'cancelled',
          expires_at = least(expires_at, now())
      where user_id = v_user_id and tier = 'pro';
  elsif v_product_id like 'theme_%' then
    v_theme_id := substr(v_product_id, 7);
    delete from public.user_themes
      where user_id = v_user_id and theme_id = v_theme_id;
  end if;

  update public.purchases
    set refunded = true, refunded_at = now()
    where id = v_purchase_id;

  return query select true, v_product_id, false;
end;
$$;

revoke all on function public.revoke_purchase(text, bigint) from public;
revoke all on function public.revoke_purchase(text, bigint) from anon, authenticated;
grant execute on function public.revoke_purchase(text, bigint) to service_role;
