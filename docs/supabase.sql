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

-- Contact form: anyone can leave a message, nobody can read them through the API (only from the dashboard).
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email      text not null check (char_length(email) between 3 and 320),
  topic      text not null check (char_length(topic) <= 80),
  message    text not null check (char_length(message) between 1 and 4000),
  user_id    uuid default auth.uid() references auth.users(id) on delete set null
);

alter table public.contact_messages enable row level security;

drop policy if exists "anyone can write" on public.contact_messages;
create policy "anyone can write" on public.contact_messages for insert to anon, authenticated with check (true);

grant insert on table public.contact_messages to anon, authenticated;
notify pgrst, 'reload schema';
