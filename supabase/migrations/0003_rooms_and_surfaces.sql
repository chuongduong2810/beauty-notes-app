-- v2 schema: Rooms and Surfaces (ADR-0008, issue #13).
-- Mirrors the RLS shape of 0001_initial.sql: auth.uid() = owner_id.
-- v1's canvases / notes columns are dropped later in issue #21.

-- Rooms ---------------------------------------------------------------------

create table if not exists rooms (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  name            text not null default 'Untitled',
  width_m         real not null default 6,
  depth_m         real not null default 6,
  height_m        real not null default 3,
  camera_yaw      real not null default 0,
  camera_pitch    real not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table rooms enable row level security;

create policy rooms_owner_select on rooms
  for select using (auth.uid() = owner_id);
create policy rooms_owner_insert on rooms
  for insert with check (auth.uid() = owner_id);
create policy rooms_owner_update on rooms
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy rooms_owner_delete on rooms
  for delete using (auth.uid() = owner_id);

-- Surfaces ------------------------------------------------------------------
-- A Room has exactly six Surfaces (one per kind). The UNIQUE constraint on
-- (room_id, kind) enforces this at the schema level so duplicate seeding
-- cannot create a malformed Room.

create table if not exists surfaces (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  kind        text not null
              check (kind in ('wall_north','wall_south','wall_east','wall_west','floor','ceiling')),
  color_id    text not null default 'warm-white',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (room_id, kind)
);

create index if not exists surfaces_room_id_idx on surfaces(room_id);

alter table surfaces enable row level security;

create policy surfaces_owner_select on surfaces
  for select using (auth.uid() = owner_id);
create policy surfaces_owner_insert on surfaces
  for insert with check (auth.uid() = owner_id);
create policy surfaces_owner_update on surfaces
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy surfaces_owner_delete on surfaces
  for delete using (auth.uid() = owner_id);
