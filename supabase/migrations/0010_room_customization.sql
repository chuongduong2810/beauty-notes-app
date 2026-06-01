-- Per-Room Customization references into the in-code Catalog (issue #107,
-- ADR-0022). A Room stores Catalog Item *ids*, never raw values, so the
-- Catalog can be retuned globally without migrating Room data (mirrors the
-- Palette/`color_id` precedent).
--
-- All four single-layer columns are NULLABLE and `furniture` defaults to an
-- empty array: null / empty means "the default look", so every existing Room
-- renders exactly as before (the render layer resolves null via
-- `defaultItemFor`). RLS on `rooms` already scopes these to the owner.

alter table rooms
  add column if not exists theme_id        text,
  add column if not exists lighting_id     text,
  add column if not exists window_style_id text,
  add column if not exists ambience_id     text,
  add column if not exists furniture       jsonb not null default '[]'::jsonb;
