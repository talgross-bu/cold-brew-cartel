-- Read-only post-deployment checks. Run in the Supabase SQL editor.
select count(*) as room_words from public.room_code_pool; -- must be 200

select relname, relrowsecurity
from pg_catalog.pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('room_code_pool', 'rooms', 'players', 'choices', 'round_results')
order by relname; -- all five relrowsecurity values must be true

select routine_name, security_type
from information_schema.routines
where routine_schema in ('public', 'private')
  and routine_name in (
    'room_state', 'create_room', 'join_room', 'get_room_state',
    'submit_choice', 'room_action'
  )
order by routine_schema, routine_name;

