-- Phase 2: Supabase consolidation (idempotent)

create extension if not exists pgcrypto;

-- Keep reward grants idempotent across retries
alter table if exists public.reward_history
  add column if not exists event_key text;

create unique index if not exists reward_history_event_key_uidx
  on public.reward_history(event_key)
  where event_key is not null;

create table if not exists public.challenge_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  claim_date date not null,
  created_at timestamptz not null default now()
);

create unique index if not exists challenge_claims_unique_daily
  on public.challenge_claims(user_id, challenge_id, claim_date);

create table if not exists public.duel_settlements (
  duel_id uuid primary key references public.duels(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.role = 'admin'
  );
$$;

create or replace function public.grant_reward_idempotent(
  p_user_id uuid,
  p_type text,
  p_xp integer,
  p_coins integer,
  p_description text,
  p_event_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_new_xp integer;
  v_new_coins integer;
  v_new_level integer;
  v_xp_to_next_level integer;
  v_level_up boolean := false;
  v_level_bonus integer := 0;
  v_payload jsonb;
begin
  select *
  into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Usuário não encontrado');
  end if;

  if p_event_key is not null then
    if exists(select 1 from public.reward_history where event_key = p_event_key) then
      return jsonb_build_object('success', true, 'message', 'Recompensa já registrada', 'xp_awarded', 0, 'coins_awarded', 0, 'level_up', false);
    end if;
  end if;

  v_new_xp := coalesce(v_profile.xp, 0) + coalesce(p_xp, 0);
  v_new_coins := coalesce(v_profile.coins, 0) + coalesce(p_coins, 0);
  v_new_level := greatest(coalesce(v_profile.level, 1), 1);
  v_xp_to_next_level := v_new_level * 100;

  if v_new_xp >= v_xp_to_next_level then
    v_new_level := v_new_level + 1;
    v_level_up := true;

    select coalesce(level_up_bonus_coins, 0)
      into v_level_bonus
    from public.avatar_economy_settings
    where is_active = true
    order by updated_at desc
    limit 1;

    v_new_coins := v_new_coins + v_level_bonus;
  end if;

  update public.profiles
  set xp = v_new_xp,
      coins = v_new_coins,
      level = v_new_level,
      updated_at = now()
  where id = p_user_id;

  insert into public.reward_history(user_id, type, xp, coins, description, event_key)
  values (p_user_id, p_type, coalesce(p_xp, 0), coalesce(p_coins, 0) + v_level_bonus, p_description, p_event_key);

  v_payload := jsonb_build_object(
    'success', true,
    'xp_awarded', coalesce(p_xp, 0),
    'coins_awarded', coalesce(p_coins, 0) + v_level_bonus,
    'level_up', v_level_up
  );

  return v_payload;
end;
$$;

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
  v_reward jsonb;
  v_desc text;
begin
  v_today := (now() at time zone coalesce(p_timezone, 'America/Sao_Paulo'))::date;

  select exists (
    select 1 from public.checkins
    where user_id = p_user_id
      and date = v_today
  ) into v_exists;

  if v_exists then
    return jsonb_build_object('success', false, 'message', 'Check-in já realizado hoje');
  end if;

  insert into public.checkins(user_id, date, class_time, timestamp)
  values (p_user_id, v_today, p_class_time, now());

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
    'checkin:' || p_user_id::text || ':' || v_today::text
  );

  select count(*)
    into v_weekly_count
  from public.checkins c
  where c.user_id = p_user_id
    and date_trunc('week', c.date::timestamp) = date_trunc('week', v_today::timestamp);

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
      'weekly_bonus:' || p_user_id::text || ':' || v_today::text || ':' || v_weekly_count::text
    );
  end if;

  return v_reward || jsonb_build_object('message', 'Check-in realizado com sucesso');
end;
$$;

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

  v_event_key := format('challenge:%s:%s:%s', p_user_id::text, p_challenge_id::text, v_today::text || ':' || (v_claims_today + 1)::text);

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

-- RLS tightening
alter table if exists public.challenges enable row level security;
alter table if exists public.duels enable row level security;
alter table if exists public.wods enable row level security;
alter table if exists public.schedule enable row level security;
alter table if exists public.items enable row level security;
alter table if exists public.box_settings enable row level security;
alter table if exists public.challenge_claims enable row level security;

-- Existing tables can keep current user policies, add admin management + TV read restrictions

drop policy if exists "Users can view own rewards or admin" on public.reward_history;
create policy "Users can view own rewards or admin" on public.reward_history
for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "Users can insert own rewards" on public.reward_history;
create policy "Users can insert own rewards" on public.reward_history
for insert with check (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "Users can view own checkins or admin" on public.checkins;
create policy "Users can view own checkins or admin" on public.checkins
for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "Users can insert own checkins or admin" on public.checkins;
create policy "Users can insert own checkins or admin" on public.checkins
for insert with check (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "Profiles readable to authenticated" on public.profiles;
create policy "Profiles readable to authenticated" on public.profiles
for select using (auth.role() = 'authenticated');

drop policy if exists "Admin manage profiles" on public.profiles;
create policy "Admin manage profiles" on public.profiles
for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "Authenticated read challenges" on public.challenges;
create policy "Authenticated read challenges" on public.challenges
for select using (auth.role() = 'authenticated');

drop policy if exists "Admin manage challenges" on public.challenges;
create policy "Admin manage challenges" on public.challenges
for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "Authenticated read duels" on public.duels;
create policy "Authenticated read duels" on public.duels
for select using (auth.uid() = challenger_id or auth.uid() = opponent_id or public.is_admin(auth.uid()));

drop policy if exists "Users create own duels" on public.duels;
create policy "Users create own duels" on public.duels
for insert with check (auth.uid() = challenger_id or public.is_admin(auth.uid()));

drop policy if exists "Users update own duels" on public.duels;
create policy "Users update own duels" on public.duels
for update using (auth.uid() = challenger_id or auth.uid() = opponent_id or public.is_admin(auth.uid()));

drop policy if exists "Authenticated read wods" on public.wods;
create policy "Authenticated read wods" on public.wods
for select using (auth.role() = 'authenticated');

drop policy if exists "Admin manage wods" on public.wods;
create policy "Admin manage wods" on public.wods
for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "Authenticated read schedule" on public.schedule;
create policy "Authenticated read schedule" on public.schedule
for select using (auth.role() = 'authenticated');

drop policy if exists "Admin manage schedule" on public.schedule;
create policy "Admin manage schedule" on public.schedule
for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "Authenticated read items" on public.items;
create policy "Authenticated read items" on public.items
for select using (auth.role() = 'authenticated');

drop policy if exists "Admin manage items" on public.items;
create policy "Admin manage items" on public.items
for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "Authenticated read box settings" on public.box_settings;
create policy "Authenticated read box settings" on public.box_settings
for select using (auth.role() = 'authenticated');

drop policy if exists "Admin manage box settings" on public.box_settings;
create policy "Admin manage box settings" on public.box_settings
for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- TV/anon restricted public feed via view
create or replace view public.tv_public_feed
with (security_invoker = true)
as
select
  p.name,
  p.level,
  p.xp,
  p.avatar_equipped,
  c.date as checkin_date,
  c.class_time,
  d.id as duel_id,
  d.type as duel_type,
  d.status as duel_status,
  d.created_at as duel_created_at
from public.profiles p
left join public.checkins c on c.user_id = p.id
left join public.duels d on d.challenger_id = p.id or d.opponent_id = p.id
where p.status = 'approved';

grant select on public.tv_public_feed to anon, authenticated;

grant execute on function public.grant_reward_idempotent(uuid, text, integer, integer, text, text) to authenticated, service_role;
grant execute on function public.perform_daily_checkin(uuid, text, text) to authenticated, service_role;
grant execute on function public.claim_challenge_reward(uuid, uuid, text) to authenticated, service_role;
