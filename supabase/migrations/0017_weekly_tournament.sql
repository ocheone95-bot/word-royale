-- Word Royale — миграция №17: weekly tournament.
-- Накатывается через `npx supabase db push`.
--
-- Retention-фича #4 из roadmap'а сессии 13: каждую неделю старт нового бордa,
-- победители получают призы. Цель — intra-week retention +10-15%.
--
-- Решения по дизайну:
-- 1) Неделя = понедельник 00:00 UTC … воскресенье 23:59:59 UTC.
--    `date_trunc('week', ...)` в Postgres возвращает Monday — это уже наш контракт.
-- 2) Total score за неделю = sum(max(score) per daily_seed). Нельзя «накачать»
--    счёт за один паззл несколькими replay'ями; берём лучший результат за день.
--    Replay-сессии включаются (юзер заплатил/посмотрел рекламу — это валидная попытка).
-- 3) Призы:
--      Топ-10 → +30 дней Word Pro (через subscriptions, как streak-30 reward).
--      Топ-100 → +5 replay credits (эквивалент ≈ 100 ⭐ потребительской ценности).
--      В UI и Bot DM это позиционируется как "5 free replays" — реальный Stars
--      cashback нельзя начислить из БД (Telegram-сайд).
-- 4) Idempotency через `weekly_tournaments.prizes_distributed`. RPC
--    `award_weekly_prizes` падает на no-op если уже раздавали.
-- 5) Минимум 7 уникальных дней (полная неделя) — призы раздаются только после
--    окончания недели. Защита от запуска cron посреди недели.

create table if not exists public.weekly_tournaments (
  week_start date primary key,
  prizes_distributed boolean not null default false,
  distributed_at timestamptz,
  top10_count int not null default 0,
  top100_count int not null default 0,
  created_at timestamptz not null default now()
);

-- current_week_start: понедельник этой недели в UTC.
create or replace function public.current_week_start()
returns date
language sql
stable
as $$
  select (date_trunc('week', (now() at time zone 'UTC')))::date;
$$;

-- previous_week_start: понедельник прошлой недели.
create or replace function public.previous_week_start()
returns date
language sql
stable
as $$
  select (date_trunc('week', (now() at time zone 'UTC')) - interval '7 days')::date;
$$;

-- get_weekly_leaderboard: топ-100 + сам юзер (если он не в топе).
-- Сортировка по total_score desc, при равенстве — по min created_at (кто раньше
-- набрал — выше).
--
-- Возвращает rank, user_id, telegram_id, first_name, username, photo_url,
-- total_score, days_played, is_self.
create or replace function public.get_weekly_leaderboard(
  p_week_start date,
  p_user_id uuid default null,
  p_limit int default 100
)
returns table (
  rank int,
  user_id uuid,
  telegram_id bigint,
  first_name text,
  username text,
  photo_url text,
  total_score int,
  days_played int,
  is_self boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_end date := p_week_start + 7;
begin
  return query
  with per_day_best as (
    select
      gs.user_id as uid,
      gs.daily_seed as seed,
      max(gs.score) as best,
      min(gs.created_at) as first_at
    from public.game_sessions gs
    where gs.daily_seed >= p_week_start and gs.daily_seed < v_week_end
    group by gs.user_id, gs.daily_seed
  ),
  per_user as (
    select
      pdb.uid,
      sum(pdb.best)::int as total,
      count(*)::int as days,
      min(pdb.first_at) as earliest
    from per_day_best pdb
    group by pdb.uid
  ),
  ranked as (
    select
      pu.uid,
      pu.total,
      pu.days,
      pu.earliest,
      row_number() over (order by pu.total desc, pu.earliest asc)::int as rnk
    from per_user pu
  ),
  top_n as (
    select * from ranked where rnk <= p_limit
  ),
  self as (
    select * from ranked
    where p_user_id is not null and uid = p_user_id and rnk > p_limit
  ),
  combined as (
    select * from top_n
    union all
    select * from self
  )
  select
    c.rnk as rank,
    c.uid as user_id,
    u.telegram_id,
    u.first_name,
    u.username,
    u.photo_url,
    c.total as total_score,
    c.days as days_played,
    (p_user_id is not null and c.uid = p_user_id) as is_self
  from combined c
  join public.users u on u.id = c.uid
  order by c.rnk asc;
end;
$$;

revoke all on function public.get_weekly_leaderboard(date, uuid, int) from public;
revoke all on function public.get_weekly_leaderboard(date, uuid, int) from anon, authenticated;
grant execute on function public.get_weekly_leaderboard(date, uuid, int) to service_role;

-- get_user_weekly_rank: позиция и total одного юзера. Используется в today-status,
-- ResultScreen, MeScreen — везде где не нужен полный список.
create or replace function public.get_user_weekly_rank(
  p_user_id uuid,
  p_week_start date default null
)
returns table (
  week_start date,
  rank int,
  total_score int,
  days_played int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week date := coalesce(p_week_start, public.current_week_start());
  v_week_end date := v_week + 7;
begin
  return query
  with per_day_best as (
    select
      gs.user_id as uid,
      gs.daily_seed as seed,
      max(gs.score) as best,
      min(gs.created_at) as first_at
    from public.game_sessions gs
    where gs.daily_seed >= v_week and gs.daily_seed < v_week_end
    group by gs.user_id, gs.daily_seed
  ),
  per_user as (
    select
      pdb.uid,
      sum(pdb.best)::int as total,
      count(*)::int as days,
      min(pdb.first_at) as earliest
    from per_day_best pdb
    group by pdb.uid
  ),
  ranked as (
    select
      pu.uid,
      pu.total,
      pu.days,
      row_number() over (order by pu.total desc, pu.earliest asc)::int as rnk
    from per_user pu
  )
  select v_week, r.rnk, r.total, r.days
  from ranked r
  where r.uid = p_user_id;
end;
$$;

revoke all on function public.get_user_weekly_rank(uuid, date) from public;
revoke all on function public.get_user_weekly_rank(uuid, date) from anon, authenticated;
grant execute on function public.get_user_weekly_rank(uuid, date) to service_role;

-- award_weekly_prizes: распределяет призы за указанную неделю.
-- Идемпотентно через weekly_tournaments.prizes_distributed.
--
-- Топ-10 → +30 дней Word Pro (продлевает существующую подписку, как streak-30).
-- Места 11-100 → +5 replay credits.
-- Призы записываются в новую таблицу weekly_prize_grants для аудита.
--
-- Возвращает (top10_count, top100_count) — UI/cron используют для логирования.
create table if not exists public.weekly_prize_grants (
  id uuid primary key default gen_random_uuid(),
  week_start date not null references public.weekly_tournaments(week_start),
  user_id uuid not null references public.users(id),
  rank int not null,
  prize_type text not null check (prize_type in ('pro_30d', 'replay_credits_5')),
  granted_at timestamptz not null default now(),
  unique (week_start, user_id)
);

create index if not exists idx_weekly_prize_grants_user on public.weekly_prize_grants(user_id);

create or replace function public.award_weekly_prizes(
  p_week_start date
)
returns table (
  awarded boolean,
  top10_count int,
  top100_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_already_distributed boolean;
  v_top10_count int := 0;
  v_top100_count int := 0;
  v_existing_expires timestamptz;
  v_new_expires timestamptz;
  v_today date := (now() at time zone 'UTC')::date;
  rec record;
begin
  -- Защита от запуска посреди недели.
  if p_week_start + 7 > v_today then
    return query select false, 0, 0;
    return;
  end if;

  insert into public.weekly_tournaments (week_start)
  values (p_week_start)
  on conflict (week_start) do nothing;

  select prizes_distributed into v_already_distributed
    from public.weekly_tournaments where week_start = p_week_start;

  if v_already_distributed then
    return query select false,
      coalesce((select t.top10_count from public.weekly_tournaments t where t.week_start = p_week_start), 0),
      coalesce((select t.top100_count from public.weekly_tournaments t where t.week_start = p_week_start), 0);
    return;
  end if;

  -- Берём топ-100 за неделю (через ту же RPC что и UI). p_user_id=null → без self.
  for rec in
    select gl.rank, gl.user_id
    from public.get_weekly_leaderboard(p_week_start, null, 100) gl
    order by gl.rank asc
  loop
    if rec.rank <= 10 then
      -- Pro на 30 дней. Если активная подписка есть — продлеваем от её expires_at.
      select s.expires_at into v_existing_expires
        from public.subscriptions s
        where s.user_id = rec.user_id and s.tier = 'pro';

      v_new_expires :=
        greatest(coalesce(v_existing_expires, now()), now())
        + interval '30 days';

      insert into public.subscriptions (
        user_id, tier, status, starts_at, expires_at, stars_amount
      )
      values (
        rec.user_id, 'pro', 'active', now(), v_new_expires, 0
      )
      on conflict (user_id) where tier = 'pro' do update
        set status = 'active',
            starts_at = least(public.subscriptions.starts_at, excluded.starts_at),
            expires_at = excluded.expires_at;

      insert into public.weekly_prize_grants (week_start, user_id, rank, prize_type)
      values (p_week_start, rec.user_id, rec.rank, 'pro_30d')
      on conflict (week_start, user_id) do nothing;

      v_top10_count := v_top10_count + 1;
    else
      -- Места 11-100: +5 replay credits.
      update public.users
        set replay_credits = replay_credits + 5
        where id = rec.user_id;

      insert into public.weekly_prize_grants (week_start, user_id, rank, prize_type)
      values (p_week_start, rec.user_id, rec.rank, 'replay_credits_5')
      on conflict (week_start, user_id) do nothing;

      v_top100_count := v_top100_count + 1;
    end if;
  end loop;

  update public.weekly_tournaments
    set prizes_distributed = true,
        distributed_at = now(),
        top10_count = v_top10_count,
        top100_count = v_top100_count
    where week_start = p_week_start;

  return query select true, v_top10_count, v_top100_count;
end;
$$;

revoke all on function public.award_weekly_prizes(date) from public;
revoke all on function public.award_weekly_prizes(date) from anon, authenticated;
grant execute on function public.award_weekly_prizes(date) to service_role;

-- list_weekly_prize_recipients: для cron'а — после раздачи получаем список
-- юзеров с telegram_id и language_code, чтобы отправить DM через Bot API.
create or replace function public.list_weekly_prize_recipients(
  p_week_start date
)
returns table (
  user_id uuid,
  telegram_id bigint,
  language_code text,
  rank int,
  prize_type text,
  first_name text
)
language sql
security definer
set search_path = public
as $$
  select
    g.user_id,
    u.telegram_id,
    null::text as language_code,
    g.rank,
    g.prize_type,
    u.first_name
  from public.weekly_prize_grants g
  join public.users u on u.id = g.user_id
  where g.week_start = p_week_start
  order by g.rank asc;
$$;

revoke all on function public.list_weekly_prize_recipients(date) from public;
revoke all on function public.list_weekly_prize_recipients(date) from anon, authenticated;
grant execute on function public.list_weekly_prize_recipients(date) to service_role;
