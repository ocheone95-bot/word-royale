-- Word Royale — миграция №6: атомарное начисление купленной темы.
-- Симметрична grant_replay_credit. Вызывается ботом из successful_payment
-- handler, когда юзер оплатил Stars-инвойс на тему.
--
-- Делает четыре вещи одной транзакцией:
--   1. upsert юзера по telegram_id
--   2. идемпотентная запись в purchases по telegram_payment_id
--   3. идемпотентная запись в user_themes по (user_id, theme_id) — если юзер
--      уже владеет этой темой, повторная покупка не дублируется
--   4. Возвращает was_new=false если payment уже обрабатывался — бот не
--      ответит юзеру второй раз.

create or replace function public.grant_theme(
  p_telegram_id bigint,
  p_username text,
  p_first_name text,
  p_theme_id text,
  p_telegram_payment_id text,
  p_stars_amount int
)
returns table (user_id uuid, was_new boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_inserted_id uuid;
  v_product_id text;
begin
  if p_theme_id is null or p_theme_id = '' then
    raise exception 'theme_id is required';
  end if;

  v_product_id := 'theme_' || p_theme_id;

  insert into public.users (telegram_id, username, first_name)
  values (p_telegram_id, p_username, p_first_name)
  on conflict (telegram_id) do update
    set last_active_at = now(),
        username = coalesce(excluded.username, public.users.username),
        first_name = coalesce(excluded.first_name, public.users.first_name)
  returning id into v_user_id;

  insert into public.purchases (user_id, product_id, stars_amount, telegram_payment_id)
  values (v_user_id, v_product_id, p_stars_amount, p_telegram_payment_id)
  on conflict (telegram_payment_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is not null then
    -- На случай если юзер уже владел темой (купил из другого аккаунта/refund-flow):
    -- идемпотентная вставка по (user_id, theme_id) PK.
    insert into public.user_themes (user_id, theme_id)
    values (v_user_id, p_theme_id)
    on conflict (user_id, theme_id) do nothing;
    return query select v_user_id, true;
  else
    return query select v_user_id, false;
  end if;
end;
$$;

revoke all on function public.grant_theme(bigint, text, text, text, text, int) from public;
revoke all on function public.grant_theme(bigint, text, text, text, text, int) from anon, authenticated;
grant execute on function public.grant_theme(bigint, text, text, text, text, int) to service_role;
