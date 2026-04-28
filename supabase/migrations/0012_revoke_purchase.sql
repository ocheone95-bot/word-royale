-- Word Royale — миграция №12: refund-handler для Stars.
-- Telegram позволяет юзерам вернуть Stars в течение 90 дней после покупки.
-- Бот ловит refunded_payment-события и зовёт revoke_purchase, который
-- атомарно: помечает purchases.refunded=true и откатывает соответствующее
-- благо. Идемпотентно по telegram_payment_id.
--
-- Откаты по продуктам (best-effort — потреблённое благо не возвращается):
--   replay            → users.replay_credits -= 1 (clamp в 0)
--   double_score      → users.double_score_date = null (если не потрачено,
--                       insert_game_session уже сам выставил null при потреблении)
--   pro_subscription  → subscriptions.status='cancelled', expires_at=least(expires_at, now())
--                       (упрощение: refund одного из нескольких продлений
--                        заэкспирит подписку целиком — в MVP допустимо)
--   theme_<id>        → delete из user_themes (юзер мгновенно теряет тему)
--   unknown           → no-op, просто метка refunded
--
-- Безопасность: матчим purchase.user_id ↔ telegram_user_id из аргумента,
-- чтобы убедиться что refund адресован тому же юзеру. Mismatch → return ok=false,
-- ничего не трогаем.

alter table public.purchases
  add column if not exists refunded boolean not null default false;

alter table public.purchases
  add column if not exists refunded_at timestamptz;

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
    -- Refund на платёж, которого мы не записывали (бот был down при successful_payment).
    -- Откатывать нечего — возвращаем ok=false с null product_id.
    return query select false, null::text, false;
    return;
  end if;

  select telegram_id into v_actual_tg_id
    from public.users where id = v_user_id;

  if v_actual_tg_id is null or v_actual_tg_id <> p_telegram_user_id then
    -- Telegram прислал refund от не того юзера — не доверяем.
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
