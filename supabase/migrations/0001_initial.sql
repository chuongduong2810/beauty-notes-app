-- Walking-skeleton schema for Beauty Notes (issue #1).
-- Mirrors PRD.md §10. RLS is uniform: auth.uid() = owner_id on both tables.

create extension if not exists "pgcrypto";

-- Canvases ------------------------------------------------------------------

create table if not exists canvases (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references auth.users(id) on delete cascade,
  name                  text not null default 'Untitled',
  camera_x              real not null default 0,
  camera_y              real not null default 0,
  camera_z              real not null default 0,
  camera_zoom           real not null default 1,
  camera_focused_depth  text not null default 'mid'
                        check (camera_focused_depth in ('back','mid','front')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table canvases enable row level security;

create policy canvases_owner_select on canvases
  for select using (auth.uid() = owner_id);
create policy canvases_owner_insert on canvases
  for insert with check (auth.uid() = owner_id);
create policy canvases_owner_update on canvases
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy canvases_owner_delete on canvases
  for delete using (auth.uid() = owner_id);

-- Notes ---------------------------------------------------------------------

create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  canvas_id   uuid not null references canvases(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  x           real not null,
  y           real not null,
  depth       text not null default 'mid' check (depth in ('back','mid','front')),
  width       real not null,
  height      real not null,
  body        text not null default '',
  color_id    text not null default 'warm-white',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists notes_canvas_id_idx on notes(canvas_id);

alter table notes enable row level security;

create policy notes_owner_select on notes
  for select using (auth.uid() = owner_id);
create policy notes_owner_insert on notes
  for insert with check (auth.uid() = owner_id);
create policy notes_owner_update on notes
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy notes_owner_delete on notes
  for delete using (auth.uid() = owner_id);
