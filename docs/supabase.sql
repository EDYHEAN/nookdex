-- Online save: one row per player, the same JSON as the export (profile, binders, collection).
-- Run in the Supabase SQL editor. Safe to run again.
create table if not exists public.saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

drop policy if exists "own save: read"   on public.saves;
drop policy if exists "own save: insert" on public.saves;
drop policy if exists "own save: update" on public.saves;
drop policy if exists "own save: delete" on public.saves;

create policy "own save: read"   on public.saves for select using (auth.uid() = user_id);
create policy "own save: insert" on public.saves for insert with check (auth.uid() = user_id);
create policy "own save: update" on public.saves for update using (auth.uid() = user_id);
create policy "own save: delete" on public.saves for delete using (auth.uid() = user_id);

-- Projects where new tables are not exposed to the API automatically: let signed-in players reach their row.
grant select, insert, update, delete on table public.saves to authenticated;
notify pgrst, 'reload schema';


-- How many players have an account: the number only, nobody's data (the home page and the welcome show it).
-- security definer: it reads auth.users, which the public key can't; it returns nothing but the count.
create or replace function public.player_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$ select count(*)::integer from auth.users $$;

revoke all on function public.player_count() from public;
grant execute on function public.player_count() to anon, authenticated;
notify pgrst, 'reload schema';

-- The studio (nookdex.com/studio): which social posts Johan published, and where. Only his accounts read and write it.
create table if not exists public.social_done (
  post_id    text not null,
  platform   text not null,
  done_at    timestamptz not null default now(),
  primary key (post_id, platform)
);

alter table public.social_done enable row level security;

drop policy if exists "studio: johan" on public.social_done;
create policy "studio: johan" on public.social_done for all
  using ((auth.jwt() ->> 'email') in ('johan.trigeard@gmail.com', 'contact@nookdex.com', 'johan@nookdex.com'))
  with check ((auth.jwt() ->> 'email') in ('johan.trigeard@gmail.com', 'contact@nookdex.com', 'johan@nookdex.com'));

grant select, insert, update, delete on table public.social_done to authenticated;
notify pgrst, 'reload schema';

-- The NookBoy's ladder (the game in the Game Boy on the desk): one row per finished run. Read and written only through
-- the two functions below: they keep a score plausible (a wave lasts 30 s) and the names short.
create table if not exists public.game_scores (
  id         bigint generated always as identity primary key,
  name       text not null,
  wave       integer not null,
  kills      integer not null,
  level      integer not null,
  starter    integer not null,
  seconds    integer not null,
  user_id    uuid,
  created_at timestamptz not null default now()
);

alter table public.game_scores enable row level security;
create index if not exists game_scores_name on public.game_scores (lower(name), created_at desc);

-- The best run of each name, best first (waves, then K.O., then the quickest).
create or replace function public.game_top(p_limit integer default 20)
returns table (name text, wave integer, kills integer, level integer, starter integer, seconds integer, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.name, b.wave, b.kills, b.level, b.starter, b.seconds, b.created_at from (
    select distinct on (lower(s.name)) s.* from public.game_scores s
    order by lower(s.name), s.wave desc, s.kills desc, s.seconds
  ) b
  order by b.wave desc, b.kills desc, b.seconds
  limit least(greatest(p_limit, 1), 100)
$$;

-- A finished run: checked, saved, and its place among the other names' best runs (1 = first).
create or replace function public.game_submit(p_name text, p_wave integer, p_kills integer, p_level integer, p_starter integer, p_seconds integer)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  clean text := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g')), 16);
begin
  if clean = '' then clean := 'Dresseur'; end if;
  if p_wave < 1 or p_wave > 500 or p_seconds < (p_wave - 1) * 30 or p_seconds > p_wave * 30 + 5
     or p_kills < 0 or p_kills > p_seconds * 40 + 40 or p_level < 1 or p_level > 300 or p_starter not in (1, 4, 7, 25, 94, 150) then
    raise exception 'implausible score';
  end if;
  -- one run every 20 seconds per name
  if exists (select 1 from public.game_scores s where lower(s.name) = lower(clean) and s.created_at > now() - interval '20 seconds') then
    raise exception 'too soon';
  end if;
  insert into public.game_scores (name, wave, kills, level, starter, seconds, user_id)
  values (clean, p_wave, p_kills, p_level, p_starter, p_seconds, auth.uid());
  return 1 + (
    select count(*) from (
      select distinct on (lower(s.name)) s.name, s.wave, s.kills, s.seconds from public.game_scores s
      where lower(s.name) <> lower(clean)
      order by lower(s.name), s.wave desc, s.kills desc, s.seconds
    ) b
    where b.wave > p_wave or (b.wave = p_wave and (b.kills > p_kills or (b.kills = p_kills and b.seconds < p_seconds)))
  );
end $$;

revoke all on function public.game_top(integer) from public;
revoke all on function public.game_submit(text, integer, integer, integer, integer, integer) from public;
grant execute on function public.game_top(integer) to anon, authenticated;
grant execute on function public.game_submit(text, integer, integer, integer, integer, integer) to anon, authenticated;
notify pgrst, 'reload schema';

-- Nook Survivors, v2 (2026-10-13): a mode per run (classic, the daily challenge, coop), the daily's day, monthly seasons.
-- game_top / game_submit stay for tabs still open on the old version (game_top now shows the classic runs only).
alter table public.game_scores add column if not exists mode text not null default 'classic';
alter table public.game_scores add column if not exists day date;
create index if not exists game_scores_mode on public.game_scores (mode, created_at desc);

create or replace function public.game_top(p_limit integer default 20)
returns table (name text, wave integer, kills integer, level integer, starter integer, seconds integer, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.name, b.wave, b.kills, b.level, b.starter, b.seconds, b.created_at from (
    select distinct on (lower(s.name)) s.* from public.game_scores s
    where s.mode = 'classic'
    order by lower(s.name), s.wave desc, s.kills desc, s.seconds
  ) b
  order by b.wave desc, b.kills desc, b.seconds
  limit least(greatest(p_limit, 1), 100)
$$;

-- The best run of each name in a mode, for a period: 'season' (this month), 'day' (the daily's day), 'all'.
create or replace function public.game_top2(p_mode text default 'classic', p_period text default 'season', p_day date default null, p_limit integer default 20)
returns table (name text, wave integer, kills integer, level integer, starter integer, seconds integer, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.name, b.wave, b.kills, b.level, b.starter, b.seconds, b.created_at from (
    select distinct on (lower(s.name)) s.* from public.game_scores s
    where s.mode = p_mode
      and (p_period = 'all'
        or (p_period = 'season' and s.created_at >= date_trunc('month', now()))
        or (p_period = 'day' and s.day = p_day))
    order by lower(s.name), s.wave desc, s.kills desc, s.seconds
  ) b
  order by b.wave desc, b.kills desc, b.seconds
  limit least(greatest(p_limit, 1), 100)
$$;

-- A finished run in a mode: checked, saved, its place in its board (this month's season; the day for the daily).
create or replace function public.game_submit2(p_name text, p_wave integer, p_kills integer, p_level integer, p_starter integer, p_seconds integer, p_mode text, p_day date default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  clean text := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g')), case when p_mode = 'coop' then 35 else 16 end);
  utc date := (now() at time zone 'utc')::date;
begin
  if clean = '' then clean := 'Dresseur'; end if;
  if p_mode not in ('classic', 'daily', 'coop') then raise exception 'unknown mode'; end if;
  if p_mode = 'daily' and (p_day is null or p_day < utc - 1 or p_day > utc + 1) then raise exception 'not today'; end if;
  if p_wave < 1 or p_wave > 500 or p_seconds < (p_wave - 1) * 30 or p_seconds > p_wave * 30 + 5
     or p_kills < 0 or p_kills > p_seconds * 40 + 40 or p_level < 1 or p_level > 300 or p_starter not in (1, 4, 7, 25, 94, 150) then
    raise exception 'implausible score';
  end if;
  if exists (select 1 from public.game_scores s where lower(s.name) = lower(clean) and s.created_at > now() - interval '20 seconds') then
    raise exception 'too soon';
  end if;
  insert into public.game_scores (name, wave, kills, level, starter, seconds, user_id, mode, day)
  values (clean, p_wave, p_kills, p_level, p_starter, p_seconds, auth.uid(), p_mode, case when p_mode = 'daily' then p_day end);
  return 1 + (
    select count(*) from (
      select distinct on (lower(s.name)) s.name, s.wave, s.kills, s.seconds from public.game_scores s
      where s.mode = p_mode and lower(s.name) <> lower(clean)
        and (case when p_mode = 'daily' then s.day = p_day else s.created_at >= date_trunc('month', now()) end)
      order by lower(s.name), s.wave desc, s.kills desc, s.seconds
    ) b
    where b.wave > p_wave or (b.wave = p_wave and (b.kills > p_kills or (b.kills = p_kills and b.seconds < p_seconds)))
  );
end $$;

revoke all on function public.game_top2(text, text, date, integer) from public;
revoke all on function public.game_submit2(text, integer, integer, integer, integer, integer, text, date) from public;
grant execute on function public.game_top2(text, text, date, integer) to anon, authenticated;
grant execute on function public.game_submit2(text, integer, integer, integer, integer, integer, text, date) to anon, authenticated;
notify pgrst, 'reload schema';

-- Nook Survivors rewards (skins…), given by hand: each player reads only their own rows, nobody writes from the site.
-- Give one:  insert into public.game_rewards (user_id, reward)
--            select id, 'skin-mewtwo' from auth.users where email = 'someone@example.com' on conflict do nothing;
create table if not exists public.game_rewards (
  user_id uuid not null references auth.users (id) on delete cascade,
  reward text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, reward)
);
alter table public.game_rewards enable row level security;
drop policy if exists "read own rewards" on public.game_rewards;
create policy "read own rewards" on public.game_rewards for select to authenticated using (auth.uid() = user_id);
grant select on public.game_rewards to authenticated;
notify pgrst, 'reload schema';

-- Nook Survivors, v3 (2026-10-15): the daily challenge (mode 'defi', lib/game/defi): ten waves against the clock, a win
-- sent as wave 11; its board ranks the wins by time (then how far the others went). The classic and coop runs stop at
-- wave 100 (its boss can take longer than 30 s). The ladder takes the challenge's Pokémon (their first form's dex).
create or replace function public.game_top2(p_mode text default 'classic', p_period text default 'season', p_day date default null, p_limit integer default 20)
returns table (name text, wave integer, kills integer, level integer, starter integer, seconds integer, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.name, b.wave, b.kills, b.level, b.starter, b.seconds, b.created_at from (
    select distinct on (lower(s.name)) s.* from public.game_scores s
    where s.mode = p_mode
      and (p_period = 'all'
        or (p_period = 'season' and s.created_at >= date_trunc('month', now()))
        or (p_period = 'day' and s.day = p_day))
    order by lower(s.name), s.wave desc, case when p_mode = 'defi' then s.seconds end, s.kills desc, s.seconds
  ) b
  order by b.wave desc, case when p_mode = 'defi' then b.seconds end, b.kills desc, b.seconds
  limit least(greatest(p_limit, 1), 100)
$$;

create or replace function public.game_submit2(p_name text, p_wave integer, p_kills integer, p_level integer, p_starter integer, p_seconds integer, p_mode text, p_day date default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  clean text := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g')), case when p_mode = 'coop' then 35 else 16 end);
  utc date := (now() at time zone 'utc')::date;
  timed boolean := p_mode = 'defi';
  top integer := case when p_mode = 'daily' then 500 else 100 end;
begin
  if clean = '' then clean := 'Dresseur'; end if;
  if p_mode not in ('classic', 'daily', 'coop', 'defi') then raise exception 'unknown mode'; end if;
  if p_mode in ('daily', 'defi') and (p_day is null or p_day < utc - 1 or p_day > utc + 1) then raise exception 'not today'; end if;
  if p_kills < 0 or p_kills > p_seconds * 40 + 40 or p_level < 1 or p_level > 300
     or p_starter not in (1, 4, 7, 25, 94, 150, 63, 133, 58, 131, 129, 66, 143) then
    raise exception 'implausible score';
  end if;
  if timed then
    -- ten waves cleared one after the other: a few seconds each at the very least, an hour at most
    if p_wave < 1 or p_wave > 11 or p_seconds < (p_wave - 1) * 6 or p_seconds > 3600 or (p_wave = 11 and p_seconds < 90) then
      raise exception 'implausible score';
    end if;
  elsif p_wave < 1 or p_wave > top or p_seconds < (p_wave - 1) * 30
     or (p_wave < 100 and p_seconds > p_wave * 30 + 5) then
    raise exception 'implausible score';
  end if;
  if exists (select 1 from public.game_scores s where lower(s.name) = lower(clean) and s.created_at > now() - interval '20 seconds') then
    raise exception 'too soon';
  end if;
  insert into public.game_scores (name, wave, kills, level, starter, seconds, user_id, mode, day)
  values (clean, p_wave, p_kills, p_level, p_starter, p_seconds, auth.uid(), p_mode, case when p_mode in ('daily', 'defi') then p_day end);
  return 1 + (
    select count(*) from (
      select distinct on (lower(s.name)) s.name, s.wave, s.kills, s.seconds from public.game_scores s
      where s.mode = p_mode and lower(s.name) <> lower(clean)
        and (case when p_mode in ('daily', 'defi') then s.day = p_day else s.created_at >= date_trunc('month', now()) end)
      order by lower(s.name), s.wave desc, case when timed then s.seconds end, s.kills desc, s.seconds
    ) b
    where b.wave > p_wave
      or (b.wave = p_wave and timed and (b.seconds < p_seconds or (b.seconds = p_seconds and b.kills > p_kills)))
      or (b.wave = p_wave and not timed and (b.kills > p_kills or (b.kills = p_kills and b.seconds < p_seconds)))
  );
end $$;

revoke all on function public.game_top2(text, text, date, integer) from public;
revoke all on function public.game_submit2(text, integer, integer, integer, integer, integer, text, date) from public;
grant execute on function public.game_top2(text, text, date, integer) to anon, authenticated;
grant execute on function public.game_submit2(text, integer, integer, integer, integer, integer, text, date) to anon, authenticated;
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------------------------------------------
-- The shop (docs/skins.md): the skins each player bought. Written by the Stripe webhook only (app/api/shop/webhook,
-- with the service role key), read by the player, one row per Stripe Checkout session.
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.purchases (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  skin text not null,
  session_id text not null unique,
  amount integer,
  currency text,
  created_at timestamptz not null default now()
);
create index if not exists purchases_user on public.purchases (user_id);
alter table public.purchases enable row level security;
drop policy if exists "a player reads their purchases" on public.purchases;
create policy "a player reads their purchases" on public.purchases for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.purchases from anon, authenticated;
notify pgrst, 'reload schema';

-- Nook Survivors, v4 (2026-10-17): the classic and coop runs go on to wave 200 (titans past 100, a giga boss every
-- 10th, the last one can take minutes); a run may start from a tier reached before (lib/game: 25, 50, … 175), its clock
-- starting there too, so the time check holds; the tier is kept (start) for the board to show.
alter table public.game_scores add column if not exists start integer not null default 1;

drop function if exists public.game_top2(text, text, date, integer);
create function public.game_top2(p_mode text default 'classic', p_period text default 'season', p_day date default null, p_limit integer default 20)
returns table (name text, wave integer, kills integer, level integer, starter integer, seconds integer, created_at timestamptz, start integer)
language sql
stable
security definer
set search_path = ''
as $$
  select b.name, b.wave, b.kills, b.level, b.starter, b.seconds, b.created_at, b.start from (
    select distinct on (lower(s.name)) s.* from public.game_scores s
    where s.mode = p_mode
      and (p_period = 'all'
        or (p_period = 'season' and s.created_at >= date_trunc('month', now()))
        or (p_period = 'day' and s.day = p_day))
    order by lower(s.name), s.wave desc, case when p_mode = 'defi' then s.seconds end, s.kills desc, s.seconds
  ) b
  order by b.wave desc, case when p_mode = 'defi' then b.seconds end, b.kills desc, b.seconds
  limit least(greatest(p_limit, 1), 100)
$$;

drop function if exists public.game_submit2(text, integer, integer, integer, integer, integer, text, date);
drop function if exists public.game_submit2(text, integer, integer, integer, integer, integer, text, date, integer);
create or replace function public.game_submit2(p_name text, p_wave integer, p_kills integer, p_level integer, p_starter integer, p_seconds integer, p_mode text, p_day date default null, p_start integer default 1)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  clean text := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g')), case when p_mode = 'coop' then 35 else 16 end);
  utc date := (now() at time zone 'utc')::date;
  timed boolean := p_mode = 'defi';
  top integer := case when p_mode = 'daily' then 500 else 200 end;
begin
  if clean = '' then clean := 'Dresseur'; end if;
  if p_mode not in ('classic', 'daily', 'coop', 'defi') then raise exception 'unknown mode'; end if;
  if p_mode in ('daily', 'defi') and (p_day is null or p_day < utc - 1 or p_day > utc + 1) then raise exception 'not today'; end if;
  if p_kills < 0 or p_kills > p_seconds * 40 + 40 or p_level < 1 or p_level > 600
     -- the four starters, Mewtwo and Gengar, the daily challenge's Pokémon, the starters to unlock (2026-10-19)
     or p_starter not in (1, 4, 7, 25, 94, 150, 63, 133, 58, 131, 129, 66, 143, 32, 74, 173, 147)
     or p_start not in (1, 25, 50, 75, 100, 125, 150, 175) or p_start > p_wave or (p_start > 1 and p_mode not in ('classic', 'coop')) then
    raise exception 'implausible score';
  end if;
  if timed then
    -- ten waves cleared one after the other: a few seconds each at the very least, an hour at most
    if p_wave < 1 or p_wave > 11 or p_seconds < (p_wave - 1) * 6 or p_seconds > 3600 or (p_wave = 11 and p_seconds < 90) then
      raise exception 'implausible score';
    end if;
  -- v5 (2026-10-19): waves last 15 s up to 24, 20 s from 25 to 49, then 30 s (lib/game/data waveStart); the most a run
  -- may take stays the 30 s rule's, so a client from before the change is still let in
  elsif p_wave < 1 or p_wave > top
     or p_seconds < (least(p_wave, 25) - 1) * 15 + greatest(0, least(p_wave, 50) - 25) * 20 + greatest(0, p_wave - 50) * 30
     or (p_wave < top and p_seconds > p_wave * 30 + 5) then
    raise exception 'implausible score';
  end if;
  if exists (select 1 from public.game_scores s where lower(s.name) = lower(clean) and s.created_at > now() - interval '20 seconds') then
    raise exception 'too soon';
  end if;
  insert into public.game_scores (name, wave, kills, level, starter, seconds, user_id, mode, day, start)
  values (clean, p_wave, p_kills, p_level, p_starter, p_seconds, auth.uid(), p_mode, case when p_mode in ('daily', 'defi') then p_day end, p_start);
  return 1 + (
    select count(*) from (
      select distinct on (lower(s.name)) s.name, s.wave, s.kills, s.seconds from public.game_scores s
      where s.mode = p_mode and lower(s.name) <> lower(clean)
        and (case when p_mode in ('daily', 'defi') then s.day = p_day else s.created_at >= date_trunc('month', now()) end)
      order by lower(s.name), s.wave desc, case when timed then s.seconds end, s.kills desc, s.seconds
    ) b
    where b.wave > p_wave
      or (b.wave = p_wave and timed and (b.seconds < p_seconds or (b.seconds = p_seconds and b.kills > p_kills)))
      or (b.wave = p_wave and not timed and (b.kills > p_kills or (b.kills = p_kills and b.seconds < p_seconds)))
  );
end $$;

revoke all on function public.game_top2(text, text, date, integer) from public;
revoke all on function public.game_submit2(text, integer, integer, integer, integer, integer, text, date, integer) from public;
grant execute on function public.game_top2(text, text, date, integer) to anon, authenticated;
grant execute on function public.game_submit2(text, integer, integer, integer, integer, integer, text, date, integer) to anon, authenticated;
notify pgrst, 'reload schema';

-- The funnel (2026-10-17, lib/funnel.ts): a random id per device (nothing personal), where it first came from, the page
-- it landed on, the days it came back, the steps it reached. Written by funnel_ping only, read as counts by funnel_stats.
-- Rows older than 13 months are dropped as new ones come (an audience measure's rule).
create table if not exists public.funnel (
  device   text primary key check (length(device) between 8 and 40),
  source   text,
  landing  text,
  lang     text,
  first_at timestamptz not null default now(),
  last_at  timestamptz not null default now(),
  days     integer not null default 1,
  steps    jsonb not null default '{}'::jsonb
);
create index if not exists funnel_first on public.funnel (first_at);
alter table public.funnel enable row level security;
revoke all on public.funnel from anon, authenticated;

create or replace function public.funnel_ping(p_device text, p_source text, p_landing text, p_lang text, p_step text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_device is null or length(p_device) not between 8 and 40 then return; end if;
  insert into public.funnel (device, source, landing, lang)
  values (p_device, left(p_source, 60), left(p_landing, 120), left(p_lang, 5))
  on conflict (device) do update set
    days = public.funnel.days + case when public.funnel.last_at::date < now()::date then 1 else 0 end,
    last_at = now();
  if p_step in ('profile', 'binder', 'cards10', 'account', 'game') then
    update public.funnel set steps = steps || jsonb_build_object(p_step, now()) where device = p_device and not steps ? p_step;
  end if;
  -- now and then, the rows older than 13 months go
  if random() < 0.01 then delete from public.funnel where last_at < now() - interval '13 months'; end if;
end $$;

-- By first source: devices first seen since p_since, and how many reached each step (returned: seen on 2 days or more)
create or replace function public.funnel_stats(p_since date default null)
returns table (source text, devices bigint, profile bigint, binder bigint, cards10 bigint, account bigint, game bigint, returned bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(f.source, '?'), count(*),
    count(*) filter (where f.steps ? 'profile'), count(*) filter (where f.steps ? 'binder'),
    count(*) filter (where f.steps ? 'cards10'), count(*) filter (where f.steps ? 'account'),
    count(*) filter (where f.steps ? 'game'), count(*) filter (where f.days >= 2)
  from public.funnel f
  where p_since is null or f.first_at >= p_since
  group by 1
  order by 2 desc
$$;

revoke all on function public.funnel_ping(text, text, text, text, text) from public;
revoke all on function public.funnel_stats(date) from public;
grant execute on function public.funnel_ping(text, text, text, text, text) to anon, authenticated;
grant execute on function public.funnel_stats(date) to anon, authenticated;
notify pgrst, 'reload schema';

-- The weekly report's accounts (scripts/analytics.mjs, 2026-10-17): counts only, open like player_count.
-- By day of sign-up: accounts, with a cloud save, back 2 days or more after signing up.
create or replace function public.growth_stats(p_days integer default 60)
returns table (day date, accounts bigint, saves bigint, returned bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select u.created_at::date, count(*), count(s.user_id), count(*) filter (where s.updated_at > u.created_at + interval '2 days')
  from auth.users u left join public.saves s on s.user_id = u.id
  where u.created_at > now() - make_interval(days => p_days)
  group by 1
  order by 1
$$;

-- Accounts and saves in all, the saves touched in the last 7 and 30 days
create or replace function public.activity_stats()
returns table (accounts bigint, saves bigint, active_7d bigint, active_30d bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from auth.users), count(*),
    count(*) filter (where s.updated_at > now() - interval '7 days'), count(*) filter (where s.updated_at > now() - interval '30 days')
  from public.saves s
$$;

revoke all on function public.growth_stats(integer) from public;
revoke all on function public.activity_stats() from public;
grant execute on function public.growth_stats(integer) to anon, authenticated;
grant execute on function public.activity_stats() to anon, authenticated;
notify pgrst, 'reload schema';
