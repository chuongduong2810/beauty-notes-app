import type { CanvasRepository } from "./canvas-repository";
import {
  defaultSurfaces,
  DEFAULT_ROOM_WIDTH_M,
  DEFAULT_ROOM_DEPTH_M,
  DEFAULT_ROOM_HEIGHT_M,
  DEFAULT_CAMERA_YAW,
  DEFAULT_CAMERA_PITCH,
  DEFAULT_CAMERA_DISTANCE,
  type Room,
  type Surface,
  type Note,
  type NewNote,
} from "./room";
import type { Annotation, NewStroke, Stroke } from "./stroke";
import type { Membership } from "./entitlements";

/** Annotation row without its `strokes` array — strokes live in their
 *  own collection in the in-memory store, matching the SQL shape. */
type AnnotationRow = Omit<Annotation, "strokes">;

/** A seeded Membership row keyed by owner, mirroring the SQL table's PK. */
type MembershipRow = NonNullable<Membership> & { owner_id: string };

/**
 * Test double for `CanvasRepository`. Mirrors the surface the Supabase
 * repo exposes so units never depend on Supabase's query builder.
 * Exposes call counters for tests that need to assert idempotency.
 */
export class InMemoryCanvasRepository implements CanvasRepository {
  rooms: Room[] = [];
  surfaces: Surface[] = [];
  notes: Note[] = [];
  annotations: AnnotationRow[] = [];
  strokes: Stroke[] = [];
  memberships: MembershipRow[] = [];
  insertRoomCalls = 0;
  insertNoteCalls = 0;
  insertStrokeCalls = 0;

  /** Test helper: seed a Membership row (the real table is webhook-written,
   *  so there is no public insert path — tests seed directly). */
  seedMembership(row: MembershipRow): void {
    this.memberships = [
      ...this.memberships.filter((m) => m.owner_id !== row.owner_id),
      row,
    ];
  }

  async getMembership(ownerId: string): Promise<Membership> {
    return this.memberships.find((m) => m.owner_id === ownerId) ?? null;
  }

  async insertRoom(owner_id: string, name: string): Promise<Room> {
    this.insertRoomCalls++;
    const now = new Date().toISOString();
    const room: Room = {
      id: `room-${this.rooms.length + 1}`,
      owner_id,
      name,
      width_m: DEFAULT_ROOM_WIDTH_M,
      depth_m: DEFAULT_ROOM_DEPTH_M,
      height_m: DEFAULT_ROOM_HEIGHT_M,
      camera_yaw: DEFAULT_CAMERA_YAW,
      camera_pitch: DEFAULT_CAMERA_PITCH,
      camera_distance: DEFAULT_CAMERA_DISTANCE,
      created_at: now,
      updated_at: now,
    };
    this.rooms.push(room);
    for (const s of defaultSurfaces()) {
      this.surfaces.push({
        id: `surface-${this.surfaces.length + 1}`,
        room_id: room.id,
        owner_id,
        kind: s.kind,
        color_id: s.color_id,
      });
    }
    return room;
  }

  async listRooms(userId: string): Promise<Room[]> {
    return this.rooms
      .filter((r) => r.owner_id === userId)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  async deleteRoomsForOwner(ownerId: string): Promise<void> {
    // Mirror the DB's ON DELETE CASCADE (ADR-0019) by hand: remove the
    // owner's rooms, then surfaces whose room was removed, then
    // notes/annotations on those surfaces, then strokes on those
    // annotations.
    const removedRoomIds = new Set(
      this.rooms.filter((r) => r.owner_id === ownerId).map((r) => r.id),
    );
    this.rooms = this.rooms.filter((r) => !removedRoomIds.has(r.id));

    const removedSurfaceIds = new Set(
      this.surfaces.filter((s) => removedRoomIds.has(s.room_id)).map((s) => s.id),
    );
    this.surfaces = this.surfaces.filter(
      (s) => !removedSurfaceIds.has(s.id),
    );

    this.notes = this.notes.filter(
      (n) => !removedSurfaceIds.has(n.surface_id),
    );

    const removedAnnotationIds = new Set(
      this.annotations
        .filter((a) => removedSurfaceIds.has(a.surface_id))
        .map((a) => a.id),
    );
    this.annotations = this.annotations.filter(
      (a) => !removedAnnotationIds.has(a.id),
    );

    this.strokes = this.strokes.filter(
      (s) => !removedAnnotationIds.has(s.annotation_id),
    );
  }

  async listSurfaces(roomId: string): Promise<Surface[]> {
    return this.surfaces.filter((s) => s.room_id === roomId);
  }

  async listNotes(roomId: string): Promise<Note[]> {
    const surfaceIds = new Set(
      this.surfaces.filter((s) => s.room_id === roomId).map((s) => s.id),
    );
    return this.notes
      .filter((n) => surfaceIds.has(n.surface_id))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async insertNote(note: NewNote): Promise<Note> {
    this.insertNoteCalls++;
    const now = new Date().toISOString();
    const row: Note = {
      id: `note-${this.notes.length + 1}`,
      ...note,
      created_at: now,
      updated_at: now,
    };
    this.notes.push(row);
    return row;
  }

  async insertNotes(notes: NewNote[]): Promise<Note[]> {
    // Mirror the SQL multi-row insert: persist in order, return the rows.
    const out: Note[] = [];
    for (const note of notes) out.push(await this.insertNote(note));
    return out;
  }

  async updateNotePin(
    id: string,
    pin: { surface_id: string; u: number; v: number },
  ): Promise<Note> {
    let updated: Note | null = null;
    this.notes = this.notes.map((n) => {
      if (n.id !== id) return n;
      updated = { ...n, ...pin, updated_at: new Date().toISOString() };
      return updated;
    });
    if (!updated) throw new Error(`updateNotePin: no Note with id ${id}`);
    return updated;
  }

  async updateNoteBody(id: string, body: string): Promise<Note> {
    let updated: Note | null = null;
    this.notes = this.notes.map((n) => {
      if (n.id !== id) return n;
      updated = { ...n, body, updated_at: new Date().toISOString() };
      return updated;
    });
    if (!updated) throw new Error(`updateNoteBody: no Note with id ${id}`);
    return updated;
  }

  async setNoteBookmark(id: string, bookmarked: boolean): Promise<Note> {
    let updated: Note | null = null;
    this.notes = this.notes.map((n) => {
      if (n.id !== id) return n;
      updated = { ...n, bookmarked, updated_at: new Date().toISOString() };
      return updated;
    });
    if (!updated) throw new Error(`setNoteBookmark: no Note with id ${id}`);
    return updated;
  }

  async deleteNote(id: string): Promise<void> {
    const before = this.notes.length;
    this.notes = this.notes.filter((n) => n.id !== id);
    if (this.notes.length === before) {
      throw new Error(`deleteNote: no Note with id ${id}`);
    }
  }

  async insertAnnotation(input: {
    surface_id: string;
    owner_id: string;
  }): Promise<Annotation> {
    const now = new Date().toISOString();
    const row: AnnotationRow = {
      id: `annotation-${this.annotations.length + 1}`,
      surface_id: input.surface_id,
      owner_id: input.owner_id,
      created_at: now,
      updated_at: now,
    };
    this.annotations.push(row);
    return { ...row, strokes: [] };
  }

  async insertStroke(
    annotationId: string,
    stroke: NewStroke,
  ): Promise<Stroke> {
    this.insertStrokeCalls++;
    const ann = this.annotations.find((a) => a.id === annotationId);
    if (!ann) throw new Error(`insertStroke: no Annotation ${annotationId}`);
    const row: Stroke = {
      id: `stroke-${this.strokes.length + 1}`,
      annotation_id: annotationId,
      points: stroke.points,
      color_id: stroke.color_id,
      width_id: stroke.width_id,
      index: stroke.index,
      created_at: new Date().toISOString(),
    };
    this.strokes.push(row);
    return row;
  }

  async deleteStroke(id: string): Promise<void> {
    const before = this.strokes.length;
    this.strokes = this.strokes.filter((s) => s.id !== id);
    if (this.strokes.length === before) {
      throw new Error(`deleteStroke: no Stroke with id ${id}`);
    }
  }

  async listAnnotations(roomId: string): Promise<Annotation[]> {
    const surfaceIds = new Set(
      this.surfaces.filter((s) => s.room_id === roomId).map((s) => s.id),
    );
    return this.annotations
      .filter((a) => surfaceIds.has(a.surface_id))
      .map((a) => ({
        ...a,
        strokes: this.strokes
          .filter((s) => s.annotation_id === a.id)
          .sort((x, y) => x.index - y.index),
      }));
  }

  async updateRoomCamera(
    id: string,
    pose: { yaw: number; pitch: number; distance: number },
  ): Promise<Room> {
    let updated: Room | null = null;
    this.rooms = this.rooms.map((r) => {
      if (r.id !== id) return r;
      updated = {
        ...r,
        camera_yaw: pose.yaw,
        camera_pitch: pose.pitch,
        camera_distance: pose.distance,
        updated_at: new Date().toISOString(),
      };
      return updated;
    });
    if (!updated) throw new Error(`updateRoomCamera: no Room with id ${id}`);
    return updated;
  }
}
