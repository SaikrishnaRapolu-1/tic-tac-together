-- Run after schema.sql. Rejects client attempts to forge game transitions.
create or replace function public.validate_game() returns trigger
language plpgsql set search_path = public as $$
declare
 s jsonb := NEW.state;
 o jsonb;
 actor text := auth.uid()::text;
 mark text;
 b jsonb;
 result jsonb := 'null'::jsonb;
 scores jsonb;
 winner text;
 changed int := 0;
 i int;
 l int[];
 wins int[][] := array[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
begin
 if actor is null then raise exception 'Authentication required'; end if;
 if TG_OP = 'INSERT' then
   s := jsonb_build_object('board', '[null,null,null,null,null,null,null,null,null]'::jsonb,
    'players', jsonb_build_object('X', left(trim(s->'players'->>'X'),20), 'O', null),
    'playerIds', jsonb_build_object('X',actor,'O',null), 'turn','X',
    'scores',jsonb_build_object('X',0,'O',0),'status','waiting','result',null,'version',1);
 else
   o := OLD.state;
   if NEW.id <> OLD.id or (s->>'version')::int <> (o->>'version')::int+1 then raise exception 'Stale update'; end if;
   if o->>'status' = 'waiting' then
     if actor = o->'playerIds'->>'X' or s->'playerIds'->>'O' is distinct from actor then raise exception 'Invalid join'; end if;
     s := o || jsonb_build_object('players', (o->'players') || jsonb_build_object('O',left(trim(s->'players'->>'O'),20)),
       'playerIds',(o->'playerIds') || jsonb_build_object('O',actor), 'status','playing','version',(o->>'version')::int+1);
   else
     if actor not in (o->'playerIds'->>'X',o->'playerIds'->>'O') then raise exception 'Not a player'; end if;
     if o->>'status' = 'finished' then
       s := o || jsonb_build_object('board','[null,null,null,null,null,null,null,null,null]'::jsonb,
         'turn','X','status','playing','result',null,'version',(o->>'version')::int+1);
     else
       mark := o->>'turn'; b := s->'board';
       if o->'playerIds'->>mark is distinct from actor then raise exception 'Not your turn'; end if;
       if jsonb_typeof(b) <> 'array' or jsonb_array_length(b) <> 9 then raise exception 'Invalid board'; end if;
       for i in 0..8 loop
         if b->i is distinct from o->'board'->i then
           changed := changed+1;
           if o->'board'->>i is not null or b->>i is distinct from mark then raise exception 'Invalid square'; end if;
         end if;
       end loop;
       if changed <> 1 then raise exception 'Exactly one move required'; end if;
       foreach l slice 1 in array wins loop
         if b->>l[1] = mark and b->>l[2] = mark and b->>l[3] = mark then
           winner := mark;
           result := jsonb_build_object('winner',mark,'line',to_jsonb(l));
           exit;
         end if;
       end loop;
       if winner is null and not exists(select 1 from jsonb_array_elements(b) v where v = 'null'::jsonb) then
         winner := 'draw'; result := jsonb_build_object('winner','draw','line','[]'::jsonb);
       end if;
       scores := o->'scores';
       if winner in ('X','O') then scores := jsonb_set(scores,array[winner],to_jsonb((scores->>winner)::int+1)); end if;
       s := o || jsonb_build_object('board',b,'turn',case when mark='X' then 'O' else 'X' end,
        'scores',scores,'result',result,'status',case when winner is null then 'playing' else 'finished' end,
        'version',(o->>'version')::int+1);
     end if;
   end if;
 end if;
 if coalesce(s->'players'->>'X','') = '' or (s->>'status' <> 'waiting' and coalesce(s->'players'->>'O','') = '') then raise exception 'Name required'; end if;
 NEW.state := s; NEW.updated_at := now(); return NEW;
end $$;
drop trigger if exists validate_game on public.games;
create trigger validate_game before insert or update on public.games
 for each row execute function public.validate_game();
