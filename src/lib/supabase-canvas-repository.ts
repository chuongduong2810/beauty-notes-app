import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanvasRepository } from "./canvas-repository";
import {
  defaultSurfaces,
  type Room,
  type Surface,
  type Note,
} from "./room";

export function supabaseCanvasRepository(
  supabase: SupabaseClient,
): CanvasRepository {
  return {
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

    async listNotes(roomId) {
      // Notes are referenced by surface_id; join surfaces to filter by Room.
      const { data, error } = await supabase
        .from("notes")
        .select("*, surfaces!inner(room_id)")
        .eq("surfaces.room_id", roomId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      // Strip the joined surface metadata before returning to callers.
      return ((data ?? []) as Array<Note & { surfaces?: unknown }>).map(
        ({ surfaces, ...rest }) => rest as Note,
      );
    },

    async insertNote(note) {
      const { data, error } = await supabase
        .from("notes")
        .insert(note)
        .select()
        .single();
      if (error) throw error;
      return data as Note;
    },

    async updateNotePin(id, pin) {
      const { data, error } = await supabase
        .from("notes")
        .update({ surface_id: pin.surface_id, u: pin.u, v: pin.v })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Note;
    },

    async updateNoteBody(id, body) {
      const { data, error } = await supabase
        .from("notes")
        .update({ body })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Note;
    },
  };
}
