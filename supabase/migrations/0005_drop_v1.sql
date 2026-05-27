-- Drop v1 schema (issue #21, ADR-0011).
-- v1 is abandoned before public release; there is no data to migrate.
-- The `notes` table survives (issue #15 reshapes it for v2 with
-- surface_id, u, v, width_cm, height_cm), but every v1-shaped column
-- and the canvases table go away here.

-- Drop the v1 batched-position-update RPC. New v2 RPC names land with
-- issue #16 (drag) when needed.
drop function if exists update_note_positions(jsonb);

-- v1 columns on notes — every Note's position lived here. v2 uses
-- (surface_id, u, v) which arrive in #15.
alter table if exists notes drop column if exists canvas_id;
alter table if exists notes drop column if exists x;
alter table if exists notes drop column if exists y;
alter table if exists notes drop column if exists depth;

-- v1 spatial container. v2's Room (rooms table) replaces it (ADR-0008).
drop table if exists canvases cascade;
