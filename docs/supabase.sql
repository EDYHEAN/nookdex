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
  -- v6 (2026-10-20): the classic and coop runs go on to wave 300
  top integer := case when p_mode = 'daily' then 500 else 300 end;
begin
  if clean = '' then clean := 'Dresseur'; end if;
  if p_mode not in ('classic', 'daily', 'coop', 'defi') then raise exception 'unknown mode'; end if;
  if p_mode in ('daily', 'defi') and (p_day is null or p_day < utc - 1 or p_day > utc + 1) then raise exception 'not today'; end if;
  if p_kills < 0 or p_kills > p_seconds * 40 + 40 or p_level < 1 or p_level > 1000
     -- the four starters, Mewtwo and Gengar, the daily challenge's Pokémon, the starters to unlock (2026-10-19)
     or p_starter not in (1, 4, 7, 25, 94, 150, 63, 133, 58, 131, 129, 66, 143, 32, 74, 173, 147)
     or p_start not in (1, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275) or p_start > p_wave or (p_start > 1 and p_mode not in ('classic', 'coop')) then
    raise exception 'implausible score';
  end if;
  if timed then
    -- ten waves cleared one after the other: a few seconds each at the very least, an hour at most
    if p_wave < 1 or p_wave > 11 or p_seconds < (p_wave - 1) * 6 or p_seconds > 3600 or (p_wave = 11 and p_seconds < 90) then
      raise exception 'implausible score';
    end if;
  -- v6 (2026-10-20): a wave ends once its foes are all knocked out (lib/game/data waveQuota), its length only the most it
  -- lasts, and a boss's wave lasts until it falls: 2 s a wave at the very least past the start tier's clock (which starts at
  -- the tier's place in the old waves: 15 s up to 24, 20 s to 49, then 30 s), 90 s a wave at most
  elsif p_wave < 1 or p_wave > top
     or p_seconds < (least(p_start, 25) - 1) * 15 + greatest(0, least(p_start, 50) - 25) * 20 + greatest(0, p_start - 50) * 30 + (p_wave - p_start) * 2
     or (p_wave < top and p_seconds > p_wave * 90 + 600) then
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

-- Clicks on the Amazon affiliate links (2026-10-19, lib/funnel watchAmazonClicks): a count per day and page kind, nothing
-- else. Written by amazon_click only, read as totals by amazon_stats (the weekly report). The sales are in Amazon's dashboard.
create table if not exists public.amazon_clicks (
  day    date not null,
  place  text not null,
  clicks integer not null default 0,
  primary key (day, place)
);
alter table public.amazon_clicks enable row level security;
revoke all on public.amazon_clicks from anon, authenticated;

create or replace function public.amazon_click(p_place text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.amazon_clicks (day, place, clicks)
  values ((now() at time zone 'utc')::date, left(coalesce(nullif(btrim(p_place), ''), 'home'), 40), 1)
  on conflict (day, place) do update set clicks = public.amazon_clicks.clicks + 1
$$;

create or replace function public.amazon_stats(p_since date default null)
returns table (place text, clicks bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.place, sum(c.clicks) from public.amazon_clicks c
  where p_since is null or c.day >= p_since
  group by c.place order by 2 desc
$$;

revoke all on function public.amazon_click(text) from public;
revoke all on function public.amazon_stats(date) from public;
grant execute on function public.amazon_click(text) to anon, authenticated;
grant execute on function public.amazon_stats(date) to anon, authenticated;
notify pgrst, 'reload schema';

-- The funnel, again (2026-10-23): robots out on the server too, and the "share" step (a public list made, lib/share).
-- lib/funnel already leaves robots out, but a crawler running an old copy of the script, or calling the function
-- straight, still counted (Googlebot made 817 "direct" devices in a week, report of 2026-10-19): the user-agent PostgREST
-- passes on is checked here as well.
create or replace function public.funnel_ping(p_device text, p_source text, p_landing text, p_lang text, p_step text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ua text := coalesce(current_setting('request.headers', true)::json ->> 'user-agent', '');
begin
  if p_device is null or length(p_device) not between 8 and 40 then return; end if;
  if ua ~* '(bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|bingpreview|python|curl|wget|node-fetch|axios)' then
    return;
  end if;
  insert into public.funnel (device, source, landing, lang)
  values (p_device, left(p_source, 60), left(p_landing, 120), left(p_lang, 5))
  on conflict (device) do update set
    days = public.funnel.days + case when public.funnel.last_at::date < now()::date then 1 else 0 end,
    last_at = now();
  if p_step in ('profile', 'binder', 'cards10', 'account', 'game', 'share') then
    update public.funnel set steps = steps || jsonb_build_object(p_step, now()) where device = p_device and not steps ? p_step;
  end if;
  if random() < 0.01 then delete from public.funnel where last_at < now() - interval '13 months'; end if;
end $$;

-- funnel_stats gains a "share" column: its return type changes, so it's dropped first
drop function if exists public.funnel_stats(date);
create function public.funnel_stats(p_since date default null)
returns table (source text, devices bigint, profile bigint, binder bigint, cards10 bigint, account bigint, game bigint, share bigint, returned bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(f.source, '?'), count(*),
    count(*) filter (where f.steps ? 'profile'), count(*) filter (where f.steps ? 'binder'),
    count(*) filter (where f.steps ? 'cards10'), count(*) filter (where f.steps ? 'account'),
    count(*) filter (where f.steps ? 'game'), count(*) filter (where f.steps ? 'share'), count(*) filter (where f.days >= 2)
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

-- A player's public list (2026-10-23, lib/share, nookdex.com/c/<slug>): "Je cherche" (the cards missing from the set binders
-- they picked, and their wishlists) and "J'échange" (the doubles they ticked), to paste in a Facebook group or a Discord.
-- Card ids only: the page finds names, scans and the day's prices in the sets' files. Its pseudo is the only thing about
-- the player (no contact, no value, no city). Without an account the list is theirs by a secret token kept in their browser
-- (only its hash is here); with one, by their account. A list nobody updated for 6 months, made without an account, goes.
-- Read and written only through the functions below.
create table if not exists public.shares (
  slug       text primary key check (slug ~ '^[a-z0-9]{8}$'),
  token_hash text,
  user_id    uuid references auth.users(id) on delete cascade,
  name       text not null default '' check (length(name) <= 24),
  lang       text not null default 'fr' check (lang in ('fr', 'en')),
  prices     boolean not null default true,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  views      integer not null default 0
);
create index if not exists shares_user on public.shares (user_id);
create index if not exists shares_token on public.shares (token_hash);
alter table public.shares enable row level security;
revoke all on public.shares from anon, authenticated;

-- Writes a list (a new one when p_slug is null or gone) and returns its slug. Errors the client reads: 'too soon' (one write
-- every 10 s), 'not yours', 'too big', 'bad list', 'busy' (too many new lists in a minute, all players together).
create or replace function public.share_put(p_slug text, p_token text, p_name text, p_lang text, p_prices boolean, p_data jsonb)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_hash text;
  v_slug text;
  v_row  public.shares%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  i      integer;
begin
  if p_token is null or length(p_token) not between 32 and 128 then raise exception 'bad token'; end if;
  v_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if p_data is null or octet_length(p_data::text) > 65536 then raise exception 'too big'; end if;
  if jsonb_typeof(p_data -> 'want') is distinct from 'array' or jsonb_typeof(p_data -> 'give') is distinct from 'array'
    or jsonb_array_length(p_data -> 'want') > 1500 or jsonb_array_length(p_data -> 'give') > 500 then
    raise exception 'bad list';
  end if;
  -- a pseudo the page can show, else none ("a trainer"): letters, digits, a few signs, no address, no insult
  if v_name !~ '^[[:alnum:] ._''-]{1,24}$' or v_name ~* '(www|https?|\.com|\.fr|\.net|pute|salop|connard|connass|encul|niqu|batard|fdp|pd\M|pedo|nazi|hitler|fuck|shit|bitch|cunt|nigg|porn|sexe?\M)' then
    v_name := '';
  end if;

  -- the list this call may write: the one asked for, else the account's, else the token's
  if p_slug is not null then
    select * into v_row from public.shares where slug = p_slug;
    if found and not (v_row.token_hash = v_hash or (v_uid is not null and v_row.user_id = v_uid)) then raise exception 'not yours'; end if;
  end if;
  if v_row.slug is null and v_uid is not null then select * into v_row from public.shares where user_id = v_uid limit 1; end if;
  if v_row.slug is null then select * into v_row from public.shares where token_hash = v_hash limit 1; end if;

  if v_row.slug is not null then
    if v_row.updated_at > now() - interval '10 seconds' then raise exception 'too soon'; end if;
    update public.shares set name = v_name, lang = coalesce(nullif(p_lang, ''), 'fr'), prices = coalesce(p_prices, true), data = p_data,
      user_id = coalesce(user_id, v_uid), updated_at = now()
    where slug = v_row.slug;
    return v_row.slug;
  end if;

  if (select count(*) from public.shares where created_at > now() - interval '1 minute') >= 30 then raise exception 'busy'; end if;
  -- 8 characters drawn from 31 (no 0/o, 1/l/i): read aloud at a fair without a mistake
  loop
    v_slug := '';
    for i in 1..8 loop
      v_slug := v_slug || substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + floor(random() * 31)::integer, 1);
    end loop;
    exit when not exists (select 1 from public.shares where slug = v_slug);
  end loop;
  insert into public.shares (slug, token_hash, user_id, name, lang, prices, data)
  values (v_slug, v_hash, v_uid, v_name, case when p_lang = 'en' then 'en' else 'fr' end, coalesce(p_prices, true), p_data);
  -- now and then, the lists made without an account and left alone for 6 months go
  if random() < 0.02 then delete from public.shares where user_id is null and updated_at < now() - interval '6 months'; end if;
  return v_slug;
end $$;

-- A list for its page (p_view: a visit, counted; the share picture reads it without counting)
create or replace function public.share_get(p_slug text, p_view boolean default false)
returns table (name text, lang text, prices boolean, data jsonb, updated_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_view then update public.shares s set views = s.views + 1 where s.slug = p_slug; end if;
  return query
    select s.name, s.lang, s.prices, s.data, s.updated_at from public.shares s
    where s.slug = p_slug and (s.user_id is not null or s.updated_at > now() - interval '6 months');
end $$;

-- « Supprimer mon lien »: by its token, or by the account
create or replace function public.share_delete(p_slug text, p_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hash text := encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
begin
  delete from public.shares s
  where s.slug = p_slug and (s.token_hash = v_hash or (auth.uid() is not null and s.user_id = auth.uid()));
  return found;
end $$;

-- The weekly report: lists in all, updated in the last 7 days, page visits
create or replace function public.share_stats()
returns table (lists bigint, updated_7d bigint, with_account bigint, views bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*), count(*) filter (where s.updated_at > now() - interval '7 days'), count(s.user_id), coalesce(sum(s.views), 0)
  from public.shares s
$$;

revoke all on function public.share_put(text, text, text, text, boolean, jsonb) from public;
revoke all on function public.share_get(text, boolean) from public;
revoke all on function public.share_delete(text, text) from public;
revoke all on function public.share_stats() from public;
grant execute on function public.share_put(text, text, text, text, boolean, jsonb) to anon, authenticated;
grant execute on function public.share_get(text, boolean) to anon, authenticated;
grant execute on function public.share_delete(text, text) to anon, authenticated;
grant execute on function public.share_stats() to anon, authenticated;
notify pgrst, 'reload schema';

-- The funnel, again (2026-10-23, onboarding-light): the "tour_done" step (the 3-step tour finished, lib/funnel). Same as above,
-- the step list one longer.
create or replace function public.funnel_ping(p_device text, p_source text, p_landing text, p_lang text, p_step text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ua text := coalesce(current_setting('request.headers', true)::json ->> 'user-agent', '');
begin
  if p_device is null or length(p_device) not between 8 and 40 then return; end if;
  if ua ~* '(bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|bingpreview|python|curl|wget|node-fetch|axios)' then
    return;
  end if;
  insert into public.funnel (device, source, landing, lang)
  values (p_device, left(p_source, 60), left(p_landing, 120), left(p_lang, 5))
  on conflict (device) do update set
    days = public.funnel.days + case when public.funnel.last_at::date < now()::date then 1 else 0 end,
    last_at = now();
  if p_step in ('profile', 'binder', 'cards10', 'account', 'game', 'share', 'tour_done') then
    update public.funnel set steps = steps || jsonb_build_object(p_step, now()) where device = p_device and not steps ? p_step;
  end if;
  if random() < 0.01 then delete from public.funnel where last_at < now() - interval '13 months'; end if;
end $$;

revoke all on function public.funnel_ping(text, text, text, text, text) from public;
grant execute on function public.funnel_ping(text, text, text, text, text) to anon, authenticated;
notify pgrst, 'reload schema';

-- The funnel, again (2026-10-24, sprint 2): the "courrier" step (the room's letter opened, lib/funnel).
create or replace function public.funnel_ping(p_device text, p_source text, p_landing text, p_lang text, p_step text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ua text := coalesce(current_setting('request.headers', true)::json ->> 'user-agent', '');
begin
  if p_device is null or length(p_device) not between 8 and 40 then return; end if;
  if ua ~* '(bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|bingpreview|python|curl|wget|node-fetch|axios)' then
    return;
  end if;
  insert into public.funnel (device, source, landing, lang)
  values (p_device, left(p_source, 60), left(p_landing, 120), left(p_lang, 5))
  on conflict (device) do update set
    days = public.funnel.days + case when public.funnel.last_at::date < now()::date then 1 else 0 end,
    last_at = now();
  if p_step in ('profile', 'binder', 'cards10', 'account', 'game', 'share', 'tour_done', 'courrier') then
    update public.funnel set steps = steps || jsonb_build_object(p_step, now()) where device = p_device and not steps ? p_step;
  end if;
  if random() < 0.01 then delete from public.funnel where last_at < now() - interval '13 months'; end if;
end $$;

revoke all on function public.funnel_ping(text, text, text, text, text) from public;
grant execute on function public.funnel_ping(text, text, text, text, text) to anon, authenticated;
notify pgrst, 'reload schema';

-- The Monday mail (2026-10-24, scripts/monday-mail.mjs): « ta collec cette semaine », to the players who asked for it.
-- A row = a yes (NookDex OS → Sauvegarde, or the account card's box): the player adds and removes their own (RLS);
-- `token` makes the one-click unsubscribe link (/api/unsubscribe), which needs no sign-in.
create table if not exists public.mail_optin (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  lang       text not null default 'fr' check (lang in ('fr', 'en')),
  token      uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  last_sent  timestamptz
);
alter table public.mail_optin enable row level security;
drop policy if exists "own optin: read"   on public.mail_optin;
drop policy if exists "own optin: insert" on public.mail_optin;
drop policy if exists "own optin: update" on public.mail_optin;
drop policy if exists "own optin: delete" on public.mail_optin;
create policy "own optin: read"   on public.mail_optin for select using (auth.uid() = user_id);
create policy "own optin: insert" on public.mail_optin for insert with check (auth.uid() = user_id);
create policy "own optin: update" on public.mail_optin for update using (auth.uid() = user_id);
create policy "own optin: delete" on public.mail_optin for delete using (auth.uid() = user_id);
grant select, insert, update, delete on table public.mail_optin to authenticated;

-- The unsubscribe link: its token alone, no sign-in
create or replace function public.mail_unsubscribe(p_token uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  with gone as (delete from public.mail_optin where token = p_token returning 1)
  select exists (select 1 from gone)
$$;
revoke all on function public.mail_unsubscribe(uuid) from public;
grant execute on function public.mail_unsubscribe(uuid) to anon, authenticated;

-- Who gets it, with their e-mail and save: the Monday Action only (service role key, a GitHub secret).
-- p_email: the test run, that one account whether it said yes or not (its token then null: no unsubscribe link).
create or replace function public.mail_recipients(p_email text default null)
returns table (user_id uuid, email text, lang text, token uuid, data jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text, coalesce(o.lang, 'fr'), o.token, s.data
  from auth.users u
  join public.saves s on s.user_id = u.id
  left join public.mail_optin o on o.user_id = u.id
  where case when p_email is null then o.user_id is not null else lower(u.email) = lower(p_email) end
$$;
revoke all on function public.mail_recipients(text) from public, anon, authenticated;
grant execute on function public.mail_recipients(text) to service_role;

-- Marked sent by the Action (service role)
create or replace function public.mail_sent(p_user uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.mail_optin set last_sent = now() where user_id = p_user
$$;
revoke all on function public.mail_sent(uuid) from public, anon, authenticated;
grant execute on function public.mail_sent(uuid) to service_role;
notify pgrst, 'reload schema';
