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
