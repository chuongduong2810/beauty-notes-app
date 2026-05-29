-- Bookmark a Note (issue #55, Notebook foundation).
-- Adds a User-set "keep this handy" flag to notes. Additive and
-- idempotent; defaults to false so existing rows are un-Bookmarked.
-- RLS policies on `notes` (from 0001_initial.sql) already filter by
-- owner_id and are untouched by this column.

alter table notes add column if not exists bookmarked boolean not null default false;
