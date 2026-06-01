import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanvasRepository } from "./canvas-repository";
import {
  defaultSurfaces,
  type Room,
  type Surface,
  type Note,
} from "./room";
import type { Annotation, Stroke, StrokePoint } from "./stroke";

/** Raw row shape returned by `select` on annotation_strokes. */
type StrokeRow = {
  id: string;
  annotation_id: string;
  points: StrokePoint[];
  color_id: string;
  width_id: Stroke["width_id"];
  index: number;
  created_at: string;
};

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

    async deleteRoomsForOwner(ownerId) {
      // The DB's ON DELETE CASCADE foreign keys take care of the children
      // (surfaces → notes/annotations → strokes), so a single delete on
      // rooms is enough (ADR-0019).
      const { error } = await supabase
        .from("rooms")
        .delete()
        .eq("owner_id", ownerId);
      if (error) throw error;
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

    async setNoteBookmark(id, bookmarked) {
      const { data, error } = await supabase
        .from("notes")
        .update({ bookmarked })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Note;
    },

    async deleteNote(id) {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },

    async insertAnnotation(input) {
      const { data, error } = await supabase
        .from("annotations")
        .insert({ surface_id: input.surface_id, owner_id: input.owner_id })
        .select()
        .single();
      if (error) throw error;
      const row = data as Omit<Annotation, "strokes">;
      return { ...row, strokes: [] };
    },

    async insertStroke(annotationId, stroke) {
      const { data, error } = await supabase
        .from("annotation_strokes")
        .insert({
          annotation_id: annotationId,
          points: stroke.points,
          color_id: stroke.color_id,
          width_id: stroke.width_id,
          index: stroke.index,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Stroke;
    },

    async deleteStroke(id) {
      const { error } = await supabase
        .from("annotation_strokes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },

    async listAnnotations(roomId) {
      // Annotations are referenced by surface_id; join surfaces to
      // filter by Room. Strokes are fetched in a second query and
      // bucketed in memory — keeps the join shallow and the JSON small.
      const { data: annRows, error: annErr } = await supabase
        .from("annotations")
        .select("*, surfaces!inner(room_id)")
        .eq("surfaces.room_id", roomId)
        .order("created_at", { ascending: true });
      if (annErr) throw annErr;
      const annotations = ((annRows ?? []) as Array<
        Omit<Annotation, "strokes"> & { surfaces?: unknown }
      >).map(({ surfaces, ...rest }) => rest);

      if (annotations.length === 0) return [];

      const { data: strokeRows, error: strokeErr } = await supabase
        .from("annotation_strokes")
        .select("*")
        .in("annotation_id", annotations.map((a) => a.id))
        .order("index", { ascending: true });
      if (strokeErr) throw strokeErr;

      const byAnnotation = new Map<string, Stroke[]>();
      for (const s of (strokeRows ?? []) as StrokeRow[]) {
        const arr = byAnnotation.get(s.annotation_id) ?? [];
        arr.push(s as Stroke);
        byAnnotation.set(s.annotation_id, arr);
      }
      return annotations.map((a) => ({
        ...a,
        strokes: byAnnotation.get(a.id) ?? [],
      }));
    },
  };
}
