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
     or p_kills < 0 or p_kills > p_seconds * 15 + 40 or p_level < 1 or p_level > 300 or p_starter not in (1, 4, 7, 25) then
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
