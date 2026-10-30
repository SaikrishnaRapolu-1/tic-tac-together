-- Enable Anonymous Sign-ins in Supabase Authentication before using the app.
create table if not exists public.games (
 id text primary key,
 state jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.games enable row level security;
drop policy if exists "Anyone can read a game" on public.games;
drop policy if exists "Anyone can create a game" on public.games;
drop policy if exists "Anyone can update a game" on public.games;
create policy "Authenticated read" on public.games for select to authenticated using (true);
create policy "Host creates" on public.games for insert to authenticated
 with check (state->'playerIds'->>'X' = auth.uid()::text);
create policy "Players join or update" on public.games for update to authenticated
 using (auth.uid()::text in (state->'playerIds'->>'X', state->'playerIds'->>'O') or state->>'status' = 'waiting')
 with check (auth.uid()::text in (state->'playerIds'->>'X', state->'playerIds'->>'O'));
-- Server-side transition validation must also be installed before public deployment.
do $$ begin
 alter publication supabase_realtime add table public.games;
exception when duplicate_object then null;
end $$;
