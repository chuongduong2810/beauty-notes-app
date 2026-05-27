-- v2 orbit-camera persistence (ADR-0009, issue #14).
-- Adds the third orbit-camera coordinate to `rooms`. `camera_yaw` and
-- `camera_pitch` were already created by 0003_rooms_and_surfaces.sql.

alter table rooms
  add column if not exists camera_distance real not null default 1.8;
