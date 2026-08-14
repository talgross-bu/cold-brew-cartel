-- Cold Brew Cartel: authoritative three-player game backend.
-- Anonymous Supabase Auth users call only the five explicitly granted RPCs.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.room_code_pool (
  word text primary key check (word ~ '^[a-z]{4,8}$'),
  active_room_id uuid unique,
  reserved_until timestamptz
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code_word text not null references public.room_code_pool(word),
  sync_key uuid not null default gen_random_uuid() unique,
  spokesperson_player_id uuid,
  phase text not null default 'lobby'
    check (phase in ('lobby', 'briefing', 'huddle', 'decision', 'result')),
  round_number integer not null default 1 check (round_number > 0),
  huddle_ends_at timestamptz,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

alter table public.room_code_pool
  add constraint room_code_pool_active_room_fk
  foreign key (active_room_id) references public.rooms(id) on delete set null;

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  cart text not null check (cart in ('A', 'B', 'C')),
  display_name text not null check (
    char_length(display_name) between 1 and 24
    and display_name !~ '[[:cntrl:]]'
  ),
  joined_at timestamptz not null default now(),
  unique (room_id, cart),
  unique (room_id, user_id)
);

alter table public.rooms
  add constraint rooms_spokesperson_fk
  foreign key (spokesperson_player_id) references public.players(id);

create table public.choices (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  player_id uuid not null references public.players(id) on delete cascade,
  price integer not null check (price in (3, 4)),
  submitted_at timestamptz not null default now(),
  unique (room_id, round_number, player_id)
);

create table public.round_results (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  prices jsonb not null,
  quantities jsonb not null,
  profits jsonb not null,
  total_profit integer not null,
  revealed_at timestamptz not null default now(),
  unique (room_id, round_number)
);

create index players_user_id_idx on public.players(user_id);
create index choices_room_round_idx on public.choices(room_id, round_number);
create index rooms_expires_at_idx on public.rooms(expires_at);

alter table public.room_code_pool enable row level security;
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.choices enable row level security;
alter table public.round_results enable row level security;

revoke all on public.room_code_pool, public.rooms, public.players,
  public.choices, public.round_results from anon, authenticated;

insert into public.room_code_pool (word) values
  ('acorn'), ('zipper'), ('apple'), ('apron'), ('arch'), ('arrow'),
  ('bagel'), ('bamboo'), ('basin'), ('basket'), ('beacon'), ('barrel'),
  ('mosaic'), ('birch'), ('blanket'), ('block'), ('blossom'), ('camera'),
  ('bottle'), ('branch'), ('brick'), ('bridge'), ('brook'), ('brush'),
  ('bucket'), ('button'), ('cabin'), ('cable'), ('cactus'), ('candle'),
  ('canvas'), ('carpet'), ('carrot'), ('closet'), ('chalk'), ('cabinet'),
  ('circle'), ('cloud'), ('clover'), ('coast'), ('cocoa'), ('coral'),
  ('cotton'), ('corner'), ('cube'), ('daisy'), ('denim'), ('desk'),
  ('dune'), ('ember'), ('fabric'), ('fern'), ('field'), ('faucet'),
  ('chimney'), ('flute'), ('forest'), ('fork'), ('frame'), ('frost'),
  ('garden'), ('globe'), ('grape'), ('grass'), ('gravel'), ('grove'),
  ('harbor'), ('hazel'), ('hill'), ('marker'), ('horizon'), ('island'),
  ('jacket'), ('jewel'), ('kettle'), ('kite'), ('lake'), ('lamp'),
  ('leaf'), ('lemon'), ('lilac'), ('linen'), ('loaf'), ('lotus'),
  ('maple'), ('marble'), ('meadow'), ('packet'), ('mint'), ('mirror'),
  ('moss'), ('napkin'), ('nest'), ('noodle'), ('oasis'), ('ocean'),
  ('olive'), ('orange'), ('orchid'), ('paper'), ('ruler'), ('pebble'),
  ('pine'), ('ticket'), ('pocket'), ('pond'), ('porch'), ('prism'),
  ('quartz'), ('quilt'), ('radish'), ('compass'), ('ribbon'), ('river'),
  ('roof'), ('cushion'), ('sand'), ('shell'), ('shelf'), ('slate'),
  ('snow'), ('soap'), ('sock'), ('spoon'), ('spruce'), ('stone'),
  ('straw'), ('stream'), ('table'), ('toast'), ('tulip'), ('twig'),
  ('valley'), ('velvet'), ('vine'), ('water'), ('wheat'), ('engine'),
  ('willow'), ('window'), ('yarn'), ('zinnia'), ('album'), ('anchor'),
  ('aspen'), ('autumn'), ('badge'), ('barley'), ('bench'), ('binder'),
  ('bowl'), ('breeze'), ('canopy'), ('carton'), ('celery'), ('chair'),
  ('clay'), ('copper'), ('cork'), ('crayon'), ('curtain'), ('drift'),
  ('easel'), ('feather'), ('folder'), ('awning'), ('glass'), ('granite'),
  ('handle'), ('hedge'), ('parcel'), ('locker'), ('ladle'), ('larch'),
  ('lattice'), ('ledger'), ('notebook'), ('paddle'), ('ladder'), ('pencil'),
  ('petal'), ('plate'), ('rope'), ('saucer'), ('patio'), ('shade'),
  ('shovel'), ('sprout'), ('stool'), ('thread'), ('tile'), ('tray'),
  ('sandal'), ('wicker'), ('magnet'), ('wool'), ('mitten'), ('broom'),
  ('pillow'), ('ridge');

create or replace function private.room_state(p_room_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_self public.players%rowtype;
  v_player_count integer;
  v_choice_count integer;
  v_own_choice integer;
  v_result jsonb;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.expires_at <= now() then raise exception 'ROOM_EXPIRED'; end if;

  select * into v_self
  from public.players
  where room_id = p_room_id and user_id = p_user_id;
  if not found then raise exception 'UNAUTHORIZED'; end if;

  select count(*) into v_player_count
  from public.players where room_id = p_room_id;
  select count(*) into v_choice_count
  from public.choices
  where room_id = p_room_id and round_number = v_room.round_number;
  select price into v_own_choice
  from public.choices
  where room_id = p_room_id
    and round_number = v_room.round_number
    and player_id = v_self.id;

  if v_room.phase = 'result' then
    select jsonb_build_object(
      'prices', prices,
      'quantities', quantities,
      'profits', profits,
      'totalProfit', total_profit,
      'revealedAt', revealed_at
    ) into v_result
    from public.round_results
    where room_id = p_room_id and round_number = v_room.round_number;
  end if;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id,
      'code', upper(v_room.code_word),
      'phase', v_room.phase,
      'roundNumber', v_room.round_number,
      'huddleEndsAt', v_room.huddle_ends_at,
      'version', v_room.version,
      'expiresAt', v_room.expires_at,
      'serverNow', now(),
      'syncKey', v_room.sync_key
    ),
    'self', jsonb_build_object(
      'playerId', v_self.id,
      'cart', v_self.cart,
      'displayName', v_self.display_name,
      'isSpokesperson', v_self.id = v_room.spokesperson_player_id,
      'submitted', v_own_choice is not null,
      'choice', v_own_choice
    ),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'cart', p.cart,
        'displayName', p.display_name,
        'submitted', exists (
          select 1 from public.choices c
          where c.room_id = p_room_id
            and c.round_number = v_room.round_number
            and c.player_id = p.id
        )
      ) order by p.cart)
      from public.players p where p.room_id = p_room_id
    ), '[]'::jsonb),
    'permissions', jsonb_build_object(
      'startGame', v_self.id = v_room.spokesperson_player_id and v_room.phase = 'lobby' and v_player_count = 3,
      'advanceBriefing', v_self.id = v_room.spokesperson_player_id and v_room.phase = 'briefing',
      'startHuddle', v_self.id = v_room.spokesperson_player_id and v_room.phase = 'huddle' and v_room.huddle_ends_at is null,
      'openDecision', v_self.id = v_room.spokesperson_player_id and v_room.phase = 'huddle',
      'reveal', v_self.id = v_room.spokesperson_player_id and v_room.phase = 'decision' and v_choice_count = 3,
      'playAgain', v_self.id = v_room.spokesperson_player_id and v_room.phase = 'result',
      'leaveLobby', v_self.id <> v_room.spokesperson_player_id and v_room.phase = 'lobby'
    ),
    'result', v_result
  );
end;
$$;

create or replace function public.create_room(p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(p_display_name);
  v_word text;
  v_room_id uuid;
  v_player_id uuid;
begin
  if v_user_id is null then raise exception 'UNAUTHORIZED'; end if;
  if char_length(v_name) not between 1 and 24 or v_name ~ '[[:cntrl:]]' then
    raise exception 'INVALID_NAME';
  end if;

  update public.room_code_pool pool
  set active_room_id = null, reserved_until = null
  where pool.active_room_id in (
    select r.id from public.rooms r where r.expires_at <= now()
  );

  select pool.word into v_word
  from public.room_code_pool pool
  where pool.active_room_id is null
  order by random()
  for update skip locked
  limit 1;
  if v_word is null then raise exception 'ROOM_CAPACITY_REACHED'; end if;

  insert into public.rooms(code_word)
  values (v_word) returning id into v_room_id;
  insert into public.players(room_id, user_id, cart, display_name)
  values (v_room_id, v_user_id, 'A', v_name) returning id into v_player_id;
  update public.rooms set spokesperson_player_id = v_player_id where id = v_room_id;
  update public.room_code_pool
  set active_room_id = v_room_id,
      reserved_until = (select expires_at from public.rooms where id = v_room_id)
  where word = v_word;

  return private.room_state(v_room_id, v_user_id);
end;
$$;

create or replace function public.join_room(p_code text, p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(p_display_name);
  v_code text := lower(btrim(p_code));
  v_room public.rooms%rowtype;
  v_existing public.players%rowtype;
  v_cart text;
begin
  if v_user_id is null then raise exception 'UNAUTHORIZED'; end if;
  if char_length(v_name) not between 1 and 24 or v_name ~ '[[:cntrl:]]' then
    raise exception 'INVALID_NAME';
  end if;

  select r.* into v_room
  from public.room_code_pool pool
  join public.rooms r on r.id = pool.active_room_id
  where pool.word = v_code
  for update of r;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.expires_at <= now() then raise exception 'ROOM_EXPIRED'; end if;

  select * into v_existing from public.players
  where room_id = v_room.id and user_id = v_user_id;
  if found then return private.room_state(v_room.id, v_user_id); end if;
  if v_room.phase <> 'lobby' then raise exception 'ROOM_ALREADY_STARTED'; end if;

  select candidate.cart into v_cart
  from (values ('B', 1), ('C', 2)) as candidate(cart, ordering)
  where not exists (
    select 1 from public.players p
    where p.room_id = v_room.id and p.cart = candidate.cart
  )
  order by candidate.ordering limit 1;
  if v_cart is null then raise exception 'ROOM_FULL'; end if;

  insert into public.players(room_id, user_id, cart, display_name)
  values (v_room.id, v_user_id, v_cart, v_name);
  update public.rooms set version = version + 1 where id = v_room.id;
  perform realtime.send(
    jsonb_build_object('version', v_room.version + 1),
    'state', 'room:' || v_room.sync_key::text, false
  );
  return private.room_state(v_room.id, v_user_id);
end;
$$;

create or replace function public.get_room_state(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  return private.room_state(p_room_id, auth.uid());
end;
$$;

create or replace function public.submit_choice(p_room_id uuid, p_price integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_player public.players%rowtype;
  v_existing_price integer;
  v_version bigint;
begin
  if v_user_id is null then raise exception 'UNAUTHORIZED'; end if;
  if p_price not in (3, 4) then raise exception 'INVALID_PRICE'; end if;
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.expires_at <= now() then raise exception 'ROOM_EXPIRED'; end if;
  select * into v_player from public.players
  where room_id = p_room_id and user_id = v_user_id;
  if not found then raise exception 'UNAUTHORIZED'; end if;
  if v_room.phase <> 'decision' then raise exception 'INVALID_PHASE'; end if;

  select price into v_existing_price from public.choices
  where room_id = p_room_id and round_number = v_room.round_number
    and player_id = v_player.id;
  if v_existing_price is not null then
    if v_existing_price <> p_price then raise exception 'CHOICE_LOCKED'; end if;
    return private.room_state(p_room_id, v_user_id);
  end if;

  insert into public.choices(room_id, round_number, player_id, price)
  values (p_room_id, v_room.round_number, v_player.id, p_price);
  update public.rooms set version = version + 1
  where id = p_room_id returning version into v_version;
  perform realtime.send(jsonb_build_object('version', v_version), 'state',
    'room:' || v_room.sync_key::text, false);
  return private.room_state(p_room_id, v_user_id);
end;
$$;

create or replace function public.room_action(p_room_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_player public.players%rowtype;
  v_count integer;
  v_version bigint;
  v_prices jsonb;
  v_quantities jsonb;
  v_profits jsonb;
  v_low_count integer;
  v_total integer;
  v_cart text;
  v_price integer;
  v_quantity integer;
  v_profit integer;
begin
  if v_user_id is null then raise exception 'UNAUTHORIZED'; end if;
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.expires_at <= now() then raise exception 'ROOM_EXPIRED'; end if;
  select * into v_player from public.players
  where room_id = p_room_id and user_id = v_user_id;
  if not found then raise exception 'UNAUTHORIZED'; end if;

  if p_action = 'leave_lobby' then
    if v_room.phase <> 'lobby' then raise exception 'INVALID_PHASE'; end if;
    if v_player.id = v_room.spokesperson_player_id then raise exception 'FORBIDDEN'; end if;
    delete from public.players where id = v_player.id;
    update public.rooms set version = version + 1
    where id = p_room_id returning version into v_version;
    perform realtime.send(jsonb_build_object('version', v_version), 'state',
      'room:' || v_room.sync_key::text, false);
    return null;
  end if;

  if v_player.id <> v_room.spokesperson_player_id then raise exception 'FORBIDDEN'; end if;

  if p_action = 'start_game' then
    if v_room.phase = 'briefing' then return private.room_state(p_room_id, v_user_id); end if;
    if v_room.phase <> 'lobby' then raise exception 'INVALID_PHASE'; end if;
    select count(*) into v_count from public.players where room_id = p_room_id;
    if v_count <> 3 then raise exception 'PLAYERS_REQUIRED'; end if;
    update public.rooms set phase = 'briefing', version = version + 1
    where id = p_room_id returning version into v_version;

  elsif p_action = 'advance_briefing' then
    if v_room.phase = 'huddle' then return private.room_state(p_room_id, v_user_id); end if;
    if v_room.phase <> 'briefing' then raise exception 'INVALID_PHASE'; end if;
    update public.rooms set phase = 'huddle', huddle_ends_at = null,
      version = version + 1 where id = p_room_id returning version into v_version;

  elsif p_action = 'start_huddle' then
    if v_room.phase <> 'huddle' then raise exception 'INVALID_PHASE'; end if;
    if v_room.huddle_ends_at is not null then return private.room_state(p_room_id, v_user_id); end if;
    update public.rooms set huddle_ends_at = now() + interval '20 seconds',
      version = version + 1 where id = p_room_id returning version into v_version;

  elsif p_action = 'open_decision' then
    if v_room.phase = 'decision' then return private.room_state(p_room_id, v_user_id); end if;
    if v_room.phase <> 'huddle' then raise exception 'INVALID_PHASE'; end if;
    update public.rooms set phase = 'decision', version = version + 1
    where id = p_room_id returning version into v_version;

  elsif p_action = 'reveal' then
    if v_room.phase = 'result' then return private.room_state(p_room_id, v_user_id); end if;
    if v_room.phase <> 'decision' then raise exception 'INVALID_PHASE'; end if;
    select count(*) into v_count from public.choices
    where room_id = p_room_id and round_number = v_room.round_number;
    if v_count <> 3 then raise exception 'CHOICES_REQUIRED'; end if;
    select count(*) into v_low_count from public.choices
    where room_id = p_room_id and round_number = v_room.round_number and price = 3;
    v_prices := '{}'::jsonb;
    v_quantities := '{}'::jsonb;
    v_profits := '{}'::jsonb;
    v_total := 0;
    for v_cart, v_price in
      select p.cart, c.price from public.players p
      join public.choices c on c.player_id = p.id
      where p.room_id = p_room_id and c.round_number = v_room.round_number
      order by p.cart
    loop
      v_quantity := case
        when v_low_count = 0 then 30
        when v_low_count = 1 and v_price = 3 then 55
        when v_low_count = 1 then 20
        when v_low_count = 2 and v_price = 3 then 45
        when v_low_count = 2 then 10
        else 35
      end;
      v_profit := (v_price - 1) * v_quantity - 55;
      v_prices := v_prices || jsonb_build_object(v_cart, v_price);
      v_quantities := v_quantities || jsonb_build_object(v_cart, v_quantity);
      v_profits := v_profits || jsonb_build_object(v_cart, v_profit);
      v_total := v_total + v_profit;
    end loop;
    insert into public.round_results(
      room_id, round_number, prices, quantities, profits, total_profit
    ) values (
      p_room_id, v_room.round_number, v_prices, v_quantities, v_profits, v_total
    ) on conflict (room_id, round_number) do nothing;
    update public.rooms set phase = 'result', version = version + 1
    where id = p_room_id returning version into v_version;

  elsif p_action = 'play_again' then
    if v_room.phase <> 'result' then raise exception 'INVALID_PHASE'; end if;
    update public.rooms set phase = 'briefing', round_number = round_number + 1,
      huddle_ends_at = null, version = version + 1
    where id = p_room_id returning version into v_version;
  else
    raise exception 'INVALID_PHASE';
  end if;

  perform realtime.send(jsonb_build_object('version', v_version), 'state',
    'room:' || v_room.sync_key::text, false);
  return private.room_state(p_room_id, v_user_id);
end;
$$;

revoke execute on function private.room_state(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.create_room(text) from public, anon;
revoke execute on function public.join_room(text, text) from public, anon;
revoke execute on function public.get_room_state(uuid) from public, anon;
revoke execute on function public.submit_choice(uuid, integer) from public, anon;
revoke execute on function public.room_action(uuid, text) from public, anon;

grant execute on function public.create_room(text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.get_room_state(uuid) to authenticated;
grant execute on function public.submit_choice(uuid, integer) to authenticated;
grant execute on function public.room_action(uuid, text) to authenticated;

