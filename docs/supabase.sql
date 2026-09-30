-- Online save: one row per player, the same JSON as the export (profile, binders, collection).
-- Run once in the Supabase SQL editor.
create table public.saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

create policy "own save: read"   on public.saves for select using (auth.uid() = user_id);
create policy "own save: insert" on public.saves for insert with check (auth.uid() = user_id);
create policy "own save: update" on public.saves for update using (auth.uid() = user_id);
create policy "own save: delete" on public.saves for delete using (auth.uid() = user_id);
