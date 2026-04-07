-- Phase 4: RPC completion + RLS hardening (minimal/idempotent)

-- Integridade para check-in diário (1 por usuário por dia)
create unique index if not exists checkins_user_date_uidx
  on public.checkins(user_id, date);

create index if not exists checkins_date_idx on public.checkins(date);
create index if not exists checkins_user_date_idx on public.checkins(user_id, date desc);

-- Feed público da TV com segurança por definidor (evita depender de policy anon nas tabelas base)
create or replace view public.tv_public_feed as
select
  p.id,
  p.name,
  p.level,
  p.xp,
  p.avatar_equipped
from public.profiles p
where p.status = 'approved';

grant select on public.tv_public_feed to anon, authenticated;

-- Status de check-in do usuário com timezone do box
create or replace function public.get_user_checkin_status(
  p_user_id uuid,
  p_timezone text default 'America/Sao_Paulo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date;
  v_checked_in boolean;
  v_last_checkin timestamptz;
begin
  v_today := (now() at time zone coalesce(p_timezone, 'America/Sao_Paulo'))::date;

  select exists (
    select 1
    from public.checkins c
    where c.user_id = p_user_id
      and c.date = v_today
  ) into v_checked_in;

  select c.timestamp
    into v_last_checkin
  from public.checkins c
  where c.user_id = p_user_id
  order by c.timestamp desc
  limit 1;

  return jsonb_build_object(
    'success', true,
    'today', v_today,
    'already_checked_in', coalesce(v_checked_in, false),
    'last_checkin_at', v_last_checkin
  );
end;
$$;

-- Janela de aula (atual e próxima), respeitando timezone
create or replace function public.get_current_class_window(
  p_timezone text default 'America/Sao_Paulo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamp;
  v_now_time time;
  v_now_dow integer;
  v_current record;
  v_next record;
begin
  v_now := now() at time zone coalesce(p_timezone, 'America/Sao_Paulo');
  v_now_time := v_now::time;
  v_now_dow := extract(dow from v_now)::integer;

  select s.id, s.time, s.end_time, s.coach, s.checkin_window_minutes
    into v_current
  from public.schedule s
  where s.is_active = true
    and (s.days is null or v_now_dow = any(s.days))
    and v_now_time between ((s.time::time - (coalesce(s.checkin_window_minutes, 60)::text || ' minutes')::interval)::time) and s.end_time::time
  order by s.time
  limit 1;

  select s.id, s.time, s.end_time, s.coach, s.checkin_window_minutes
    into v_next
  from public.schedule s
  where s.is_active = true
    and (s.days is null or v_now_dow = any(s.days))
    and s.time::time >= v_now_time
  order by s.time
  limit 1;

  return jsonb_build_object(
    'success', true,
    'timezone', coalesce(p_timezone, 'America/Sao_Paulo'),
    'now', v_now,
    'current_class', case when v_current is null then null else jsonb_build_object(
      'id', v_current.id,
      'time', v_current.time,
      'end_time', v_current.end_time,
      'coach', v_current.coach,
      'checkin_window_minutes', v_current.checkin_window_minutes
    ) end,
    'next_class', case when v_next is null then null else jsonb_build_object(
      'id', v_next.id,
      'time', v_next.time,
      'end_time', v_next.end_time,
      'coach', v_next.coach,
      'checkin_window_minutes', v_next.checkin_window_minutes
    ) end
  );
end;
$$;

-- Ranking mensal por frequência
create or replace function public.get_monthly_frequency_ranking(
  p_limit integer default 50,
  p_timezone text default 'America/Sao_Paulo'
)
returns table(
  id uuid,
  name text,
  level integer,
  xp integer,
  avatar_equipped jsonb,
  month_checkin_count bigint
)
language sql
security definer
set search_path = public
as $$
  with bounds as (
    select date_trunc('month', (now() at time zone coalesce(p_timezone, 'America/Sao_Paulo')))::date as month_start
  )
  select
    p.id,
    p.name,
    p.level,
    p.xp,
    p.avatar_equipped,
    count(c.id)::bigint as month_checkin_count
  from public.profiles p
  left join bounds b on true
  left join public.checkins c
    on c.user_id = p.id
   and c.date >= b.month_start
  where p.status = 'approved'
  group by p.id, p.name, p.level, p.xp, p.avatar_equipped
  order by month_checkin_count desc, p.xp desc, p.name asc
  limit greatest(coalesce(p_limit, 50), 1);
$$;

-- Ranking geral por XP
create or replace function public.get_general_xp_ranking(
  p_limit integer default 50
)
returns table(
  id uuid,
  name text,
  level integer,
  xp integer,
  coins integer,
  avatar_equipped jsonb,
  month_checkin_count bigint
)
language sql
security definer
set search_path = public
as $$
  with month_counts as (
    select c.user_id, count(*)::bigint as month_checkin_count
    from public.checkins c
    where c.date >= date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date
    group by c.user_id
  )
  select
    p.id,
    p.name,
    p.level,
    p.xp,
    p.coins,
    p.avatar_equipped,
    coalesce(mc.month_checkin_count, 0) as month_checkin_count
  from public.profiles p
  left join month_counts mc on mc.user_id = p.id
  where p.status = 'approved'
  order by p.xp desc, p.level desc, p.name asc
  limit greatest(coalesce(p_limit, 50), 1);
$$;

-- Check-in diário seguro, com validação de janela e bônus idempotentes por semana/mês
create or replace function public.perform_daily_checkin(
  p_user_id uuid,
  p_class_time text default null,
  p_timezone text default 'America/Sao_Paulo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date;
  v_xp integer := 20;
  v_coins integer := 5;
  v_exists boolean;
  v_weekly_count integer;
  v_monthly_count integer;
  v_reward jsonb;
  v_desc text;
  v_week_start date;
  v_month_start date;
  v_current_class jsonb;
  v_checkin_date_text text;
begin
  v_today := (now() at time zone coalesce(p_timezone, 'America/Sao_Paulo'))::date;
  v_checkin_date_text := v_today::text;

  select exists (
    select 1 from public.checkins
    where user_id = p_user_id
      and date = v_today
  ) into v_exists;

  if v_exists then
    return jsonb_build_object('success', false, 'message', 'Check-in já realizado hoje');
  end if;

  if p_class_time is not null then
    select (public.get_current_class_window(coalesce(p_timezone, 'America/Sao_Paulo'))->'current_class')
      into v_current_class;

    if v_current_class is null then
      return jsonb_build_object('success', false, 'message', 'Fora da janela de check-in da turma');
    end if;
  end if;

  insert into public.checkins(user_id, date, class_time, timestamp)
  values (p_user_id, v_today, p_class_time, now())
  on conflict (user_id, date) do nothing;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Check-in já realizado hoje');
  end if;

  select coalesce(xp_per_checkin, 20), coalesce(coins_per_checkin, 5)
    into v_xp, v_coins
  from public.avatar_economy_settings
  where is_active = true
  order by updated_at desc
  limit 1;

  v_desc := format('Check-in diário (%s)', coalesce(p_class_time, 'sem turma'));

  v_reward := public.grant_reward_idempotent(
    p_user_id,
    'checkin',
    v_xp,
    v_coins,
    v_desc,
    'checkin:' || p_user_id::text || ':' || v_checkin_date_text
  );

  v_week_start := date_trunc('week', v_today::timestamp)::date;
  select count(*)
    into v_weekly_count
  from public.checkins c
  where c.user_id = p_user_id
    and c.date >= v_week_start
    and c.date < (v_week_start + interval '7 days')::date;

  if v_weekly_count between 3 and 6 then
    select
      case v_weekly_count
        when 3 then coalesce(weekly_bonus_3_xp, 0)
        when 4 then coalesce(weekly_bonus_4_xp, 0)
        when 5 then coalesce(weekly_bonus_5_xp, 0)
        when 6 then coalesce(weekly_bonus_6_xp, 0)
        else 0
      end,
      case v_weekly_count
        when 3 then coalesce(weekly_bonus_3_coins, 0)
        when 4 then coalesce(weekly_bonus_4_coins, 0)
        when 5 then coalesce(weekly_bonus_5_coins, 0)
        when 6 then coalesce(weekly_bonus_6_coins, 0)
        else 0
      end
      into v_xp, v_coins
    from public.avatar_economy_settings
    where is_active = true
    order by updated_at desc
    limit 1;

    perform public.grant_reward_idempotent(
      p_user_id,
      'weekly_bonus',
      coalesce(v_xp, 0),
      coalesce(v_coins, 0),
      format('Bônus semanal %s check-ins', v_weekly_count),
      format('weekly_bonus:%s:%s:%s', p_user_id::text, v_week_start::text, v_weekly_count::text)
    );
  end if;

  v_month_start := date_trunc('month', v_today::timestamp)::date;
  select count(*)
    into v_monthly_count
  from public.checkins c
  where c.user_id = p_user_id
    and c.date >= v_month_start
    and c.date < (v_month_start + interval '1 month')::date;

  if v_monthly_count in (12, 16, 20) then
    perform public.grant_reward_idempotent(
      p_user_id,
      'monthly_bonus',
      case v_monthly_count when 12 then 30 when 16 then 50 else 80 end,
      case v_monthly_count when 12 then 10 when 16 then 15 else 25 end,
      format('Bônus mensal %s check-ins', v_monthly_count),
      format('monthly_bonus:%s:%s:%s', p_user_id::text, v_month_start::text, v_monthly_count::text)
    );
  end if;

  return v_reward || jsonb_build_object('message', 'Check-in realizado com sucesso');
end;
$$;

-- Corrige função de desafio com erro de sintaxe e idempotência explícita
create or replace function public.claim_challenge_reward(
  p_user_id uuid,
  p_challenge_id uuid,
  p_timezone text default 'America/Sao_Paulo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date;
  v_challenge public.challenges%rowtype;
  v_claims_today integer;
  v_xp integer;
  v_coins integer;
  v_reward jsonb;
  v_event_key text;
  v_claim_sequence integer;
begin
  v_today := (now() at time zone coalesce(p_timezone, 'America/Sao_Paulo'))::date;

  select * into v_challenge
  from public.challenges
  where id = p_challenge_id
    and active = true;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Desafio não encontrado/inativo');
  end if;

  if v_challenge.start_date is not null and v_today < v_challenge.start_date then
    return jsonb_build_object('success', false, 'message', 'Desafio ainda não iniciou');
  end if;

  if v_challenge.end_date is not null and v_today > v_challenge.end_date then
    return jsonb_build_object('success', false, 'message', 'Desafio encerrado');
  end if;

  select count(*) into v_claims_today
  from public.challenge_claims
  where user_id = p_user_id
    and challenge_id = p_challenge_id
    and claim_date = v_today;

  if coalesce(v_challenge.repeatable, false) = false then
    if exists (
      select 1
      from public.challenge_claims
      where user_id = p_user_id
        and challenge_id = p_challenge_id
    ) then
      return jsonb_build_object('success', false, 'message', 'Desafio já resgatado');
    end if;
  elsif coalesce(v_challenge.daily_limit, 0) > 0 and v_claims_today >= v_challenge.daily_limit then
    return jsonb_build_object('success', false, 'message', 'Limite diário atingido');
  end if;

  insert into public.challenge_claims(user_id, challenge_id, claim_date)
  values (p_user_id, p_challenge_id, v_today);

  v_claim_sequence := v_claims_today + 1;

  v_xp := coalesce(v_challenge.xp, 0);
  v_coins := coalesce(v_challenge.coins, 0);

  select
    coalesce(
      case v_challenge.difficulty
        when 'easy' then challenge_easy_xp
        when 'medium' then challenge_medium_xp
        when 'hard' then challenge_hard_xp
        when 'special' then challenge_special_xp
        else null
      end,
      v_xp
    ),
    coalesce(
      case v_challenge.difficulty
        when 'easy' then challenge_easy_coins
        when 'medium' then challenge_medium_coins
        when 'hard' then challenge_hard_coins
        when 'special' then challenge_special_coins
        else null
      end,
      v_coins
    )
  into v_xp, v_coins
  from public.avatar_economy_settings
  where is_active = true
  order by updated_at desc
  limit 1;

  v_event_key := format('challenge:%s:%s:%s:%s', p_user_id::text, p_challenge_id::text, v_today::text, v_claim_sequence::text);

  v_reward := public.grant_reward_idempotent(
    p_user_id,
    'challenge',
    v_xp,
    v_coins,
    format('Desafio concluído: %s', v_challenge.title),
    v_event_key
  );

  return v_reward || jsonb_build_object('message', 'Recompensa de desafio concedida');
end;
$$;

grant execute on function public.get_user_checkin_status(uuid, text) to authenticated, service_role;
grant execute on function public.get_current_class_window(text) to anon, authenticated, service_role;
grant execute on function public.get_monthly_frequency_ranking(integer, text) to anon, authenticated, service_role;
grant execute on function public.get_general_xp_ranking(integer) to anon, authenticated, service_role;
