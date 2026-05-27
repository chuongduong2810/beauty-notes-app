import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CanvasRepository,
  CanvasRow,
  NewNote,
  NoteRow,
} from "./canvas-repository";
import { defaultSurfaces, type Room, type Surface } from "./room";

export function supabaseCanvasRepository(
  supabase: SupabaseClient,
): CanvasRepository {
  return {
    async listCanvases(userId) {
      const { data, error } = await supabase
        .from("canvases")
        .select("*")
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CanvasRow[];
    },

    async insertCanvas(owner_id, name) {
      const { data, error } = await supabase
        .from("canvases")
        .insert({ owner_id, name })
        .select()
        .single();
      if (error) throw error;
      return data as CanvasRow;
    },

    async listNotes(canvas_id) {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("canvas_id", canvas_id);
      if (error) throw error;
      return (data ?? []) as NoteRow[];
    },

    async insertNote(note: NewNote) {
      const { data, error } = await supabase
        .from("notes")
        .insert(note)
        .select()
        .single();
      if (error) throw error;
      return data as NoteRow;
    },

    async deleteNotes(ids) {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("notes")
        .delete()
        .in("id", ids as string[])
        .select();
      if (error) throw error;
      return (data ?? []) as NoteRow[];
    },

    async updateNotePositions(updates) {
      if (updates.length === 0) return [];
      // One SQL UPDATE on the server via RPC — see
      // supabase/migrations/0002_update_note_positions.sql. RLS still
      // applies because the function's WHERE filters on auth.uid().
      const { data, error } = await supabase.rpc("update_note_positions", {
        updates: updates as { id: string; x: number; y: number }[],
      });
      if (error) throw error;
      return (data ?? []) as NoteRow[];
    },

    async insertRoom(owner_id, name) {
      const { data: room, error: roomErr } = await supabase
        .from("rooms")
        .insert({ owner_id, name })
        .select()
        .single();
      if (roomErr) throw roomErr;
      const seed = defaultSurfaces().map((s) => ({
        room_id: (room as Room).id,
        owner_id,
        kind: s.kind,
        color_id: s.color_id,
      }));
      const { error: surfErr } = await supabase.from("surfaces").insert(seed);
      if (surfErr) throw surfErr;
      return room as Room;
    },

    async listRooms(userId) {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Room[];
    },

    async listSurfaces(roomId) {
      const { data, error } = await supabase
        .from("surfaces")
        .select("*")
        .eq("room_id", roomId);
      if (error) throw error;
      return (data ?? []) as Surface[];
    },

    async updateRoomCamera(id, { yaw, pitch, distance }) {
      const { data, error } = await supabase
        .from("rooms")
        .update({
          camera_yaw: yaw,
          camera_pitch: pitch,
          camera_distance: distance,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Room;
    },
  };
}
