-- Word Royale — миграция №3: атомарное начисление replay-кредита.
-- Накатывается через Supabase Studio: SQL Editor → New query → paste → Run.
--
-- Функция вызывается ботом из successful_payment handler. Делает три вещи
-- одной транзакцией:
--   1. upsert юзера по telegram_id (на случай если оплатил тот, кто ещё не
--      открывал Mini App)
--   2. идемпотентная запись в purchases по telegram_payment_id (повторный
--      webhook не задвоит начисление)
--   3. инкремент users.replay_credits — только если запись в purchases реально
--      произошла (was_new = true)
--
-- Возвращает was_new=false, если payment уже обрабатывался — бот не отвечает
-- юзеру второй раз.

create or replace function public.grant_replay_credit(
  p_telegram_id bigint,
  p_username text,
  p_first_name text,
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
begin
  insert into public.users (telegram_id, username, first_name)
  values (p_telegram_id, p_username, p_first_name)
  on conflict (telegram_id) do update
    set last_active_at = now(),
        username = coalesce(excluded.username, public.users.username),
        first_name = coalesce(excluded.first_name, public.users.first_name)
  returning id into v_user_id;

  insert into public.purchases (user_id, product_id, stars_amount, telegram_payment_id)
  values (v_user_id, 'replay', p_stars_amount, p_telegram_payment_id)
  on conflict (telegram_payment_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is not null then
    update public.users
      set replay_credits = replay_credits + 1
      where id = v_user_id;
    return query select v_user_id, true;
  else
    return query select v_user_id, false;
  end if;
end;
$$;

-- Только service_role может вызывать (бот ходит под service_role key).
revoke all on function public.grant_replay_credit(bigint, text, text, text, int) from public;
revoke all on function public.grant_replay_credit(bigint, text, text, text, int) from anon, authenticated;
grant execute on function public.grant_replay_credit(bigint, text, text, text, int) to service_role;
