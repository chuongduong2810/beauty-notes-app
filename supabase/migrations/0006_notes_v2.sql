-- v2 Note shape (issue #15, ADR-0010).
-- After 0005 dropped the v1 columns (canvas_id, x, y, depth), the notes
-- table is in a transitional state. This migration finishes the reshape:
-- attach each Note to a Surface at (u, v) and switch dimensions from
-- pixels to centimetres.

alter table notes drop column if exists width;
alter table notes drop column if exists height;

alter table notes
  add column if not exists surface_id uuid
    references surfaces(id) on delete cascade,
  add column if not exists u real not null default 0.5
    check (u >= 0 and u <= 1),
  add column if not exists v real not null default 0.5
    check (v >= 0 and v <= 1),
  add column if not exists width_cm real not null default 12,
  add column if not exists height_cm real not null default 9;

-- surface_id is required now that v1's canvas_id is gone. We added it
-- nullable above so the migration succeeds against an empty table; flip
-- to NOT NULL once any straggler rows (which would be impossible after
-- 0005 + this migration on a fresh DB anyway) are gone.
alter table notes alter column surface_id set not null;

create index if not exists notes_surface_id_idx on notes(surface_id);

-- RLS policies on `notes` were created by 0001_initial.sql and survive
-- the column changes — they filter on owner_id which is untouched.
