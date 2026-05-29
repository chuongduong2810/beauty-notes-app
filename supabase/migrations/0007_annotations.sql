-- Annotations + Strokes (issue #35, ADR-0014).
-- Mirrors the RLS shape of 0001_initial.sql and 0003_rooms_and_surfaces.sql:
-- auth.uid() = owner_id. Strokes inherit access via their parent Annotation.

-- Annotations ---------------------------------------------------------------
-- An Annotation groups every Stroke a User drew on a Surface during one
-- Pen-mode session. One Surface can have many Annotations.

create table if not exists annotations (
  id          uuid primary key default gen_random_uuid(),
  surface_id  uuid not null references surfaces(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists annotations_surface_id_idx on annotations(surface_id);

alter table annotations enable row level security;

create policy annotations_owner_select on annotations
  for select using (auth.uid() = owner_id);
create policy annotations_owner_insert on annotations
  for insert with check (auth.uid() = owner_id);
create policy annotations_owner_update on annotations
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy annotations_owner_delete on annotations
  for delete using (auth.uid() = owner_id);

-- Strokes -------------------------------------------------------------------
-- Each Stroke is a polyline of (u, v, p, t) points (normalized 0..1)
-- stored as a single jsonb blob. The width is one of the four named
-- widths in src/lib/stroke.ts; the colour references the in-code Palette
-- so a retune doesn't need a data migration. `index` is the order the
-- Stroke was drawn within its Annotation (older first).

create table if not exists annotation_strokes (
  id              uuid primary key default gen_random_uuid(),
  annotation_id   uuid not null references annotations(id) on delete cascade,
  points          jsonb not null,
  color_id        text not null,
  width_id        text not null
                  check (width_id in ('fine','medium','bold','marker')),
  index           integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists annotation_strokes_annotation_id_idx
  on annotation_strokes(annotation_id);

alter table annotation_strokes enable row level security;

-- Strokes don't carry their own owner_id; access is gated by joining
-- back to the parent Annotation and checking its owner.
create policy annotation_strokes_owner_select on annotation_strokes
  for select using (
    exists (
      select 1 from annotations a
      where a.id = annotation_strokes.annotation_id
        and a.owner_id = auth.uid()
    )
  );
create policy annotation_strokes_owner_insert on annotation_strokes
  for insert with check (
    exists (
      select 1 from annotations a
      where a.id = annotation_strokes.annotation_id
        and a.owner_id = auth.uid()
    )
  );
create policy annotation_strokes_owner_update on annotation_strokes
  for update using (
    exists (
      select 1 from annotations a
      where a.id = annotation_strokes.annotation_id
        and a.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from annotations a
      where a.id = annotation_strokes.annotation_id
        and a.owner_id = auth.uid()
    )
  );
create policy annotation_strokes_owner_delete on annotation_strokes
  for delete using (
    exists (
      select 1 from annotations a
      where a.id = annotation_strokes.annotation_id
        and a.owner_id = auth.uid()
    )
  );
