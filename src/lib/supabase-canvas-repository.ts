import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CanvasRepository,
  CanvasRow,
  NewNote,
  NoteRow,
} from "./canvas-repository";

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
  };
}
