-- One-shot batched UPDATE for issue #3 drag-end commits.
--
-- A plain `.update().in('id', ids)` from the client can't carry a
-- per-row (x, y), and `.upsert()` would fail the NOT NULL constraints
-- on the INSERT-side path (canvas_id, owner_id, etc.). The cleanest
-- single-round-trip option is a SECURITY INVOKER server function that
-- joins a JSONB array of updates against the notes table.
--
-- RLS still applies through `auth.uid() = owner_id` because the
-- function runs under the invoker's role.

create or replace function public.update_note_positions(updates jsonb)
returns setof public.notes
language sql
security invoker
as $$
  update public.notes n
  set
    x = (u->>'x')::real,
    y = (u->>'y')::real,
    updated_at = now()
  from jsonb_array_elements(updates) u
  where n.id = (u->>'id')::uuid
    and n.owner_id = auth.uid()
  returning n.*;
$$;

revoke all on function public.update_note_positions(jsonb) from public;
grant execute on function public.update_note_positions(jsonb) to authenticated;
