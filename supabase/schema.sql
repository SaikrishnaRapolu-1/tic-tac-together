-- Run this once in Supabase SQL Editor. Realtime is enabled for public.games below.
create table if not exists public.games (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.games enable row level security;
create policy "Anyone can read a game" on public.games for select using (true);
create policy "Anyone can create a game" on public.games for insert with check (true);
create policy "Anyone can update a game" on public.games for update using (true) with check (true);
do $$ begin
  alter publication supabase_realtime add table public.games;
exception when duplicate_object then null;
end $$;
