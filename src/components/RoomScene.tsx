import { useEffect, useMemo, useRef, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { Mesh, Raycaster, Vector2 } from "three";
import type { Room, Surface, Note, SurfaceKind } from "../lib/room";
import { paletteEntry } from "../lib/palette";
import { catalogItem, defaultItemFor } from "../lib/catalog";
import { surfaceTransform } from "../lib/surface-geometry";
import { HoverTooltip } from "./HoverTooltip";
import { NoteMesh } from "./NoteMesh";
import { PenProp } from "./PenProp";
import { StrokeMesh } from "./StrokeMesh";
import { useAppStore } from "../store";

/** Where the trash bin sits on the floor (world coordinates, metres). */
const TRASH_POSITION: [number, number, number] = [-1.2, 0, -2.2];

const isWall = (kind: SurfaceKind): boolean => kind.startsWith("wall_");

/**
 * Pen mesh that hovers at the cursor's wall hit while a Stroke is in
 * progress (issue #35 follow-up). Mounted as a child of the active
 * Surface mesh so the (u, v) → local-(x, y) math matches the StrokeMesh
 * renderer, and so the Surface's world transform handles orienting the
 * pen relative to whichever wall the user is drawing on.
 *
 * The PenProp's +Y is along the pen body — we rotate +90° around X so
 * the body extends along the Surface's +Z (outward from the wall, into
 * the room), then back off by ~20° to read as a natural writing-hand
 * tilt rather than a perpendicular needle.
 */
function PenCursor({
  surfaceId,
  surfaceWidthM,
  surfaceHeightM,
}: {
  surfaceId: string;
  surfaceWidthM: number;
  surfaceHeightM: number;
}) {
  // Prefer the in-progress stroke's last point when actively drawing;
  // otherwise fall back to the cursor's idle hover point so the pen
  // tracks the wall the moment Pen mode is entered.
  const point = useAppStore((s) => {
    const inProgress = s.penState.inProgressStroke;
    if (inProgress?.surface_id === surfaceId) {
      const ps = inProgress.points;
      return ps.length > 0 ? { u: ps[ps.length - 1].u, v: ps[ps.length - 1].v } : null;
    }
    const hover = s.penHoverPoint;
    if (hover?.surface_id === surfaceId) return { u: hover.u, v: hover.v };
    return null;
  });
  if (!point) return null;
  const x = (point.u - 0.5) * surfaceWidthM;
  const y = (point.v - 0.5) * surfaceHeightM;
  return (
    <group
      position={[x, y, 0.001]}
      rotation={[Math.PI / 2 - 0.35, 0, 0.25]}
    >
      <PenProp raycastEnabled={false} />
    </group>
  );
}

/**
 * Live preview of the Stroke currently being drawn. Subscribes to the
 * in-progress points directly so each appended point re-renders the
 * polyline without waiting for the commit-to-repo roundtrip.
 */
function InProgressStrokePreview({
  surfaceWidthM,
  surfaceHeightM,
}: {
  surfaceWidthM: number;
  surfaceHeightM: number;
}) {
  const points = useAppStore(
    (s) => s.penState.inProgressStroke?.points ?? null,
  );
  const colorId = useAppStore((s) => s.penState.pen.color_id);
  const widthId = useAppStore((s) => s.penState.pen.width_id);
  if (!points || points.length < 2) return null;
  return (
    <StrokeMesh
      stroke={{
        id: "in-progress",
        annotation_id: "in-progress",
        points,
        color_id: colorId,
        width_id: widthId,
        index: 0,
        created_at: "",
      }}
      surfaceWidthM={surfaceWidthM}
      surfaceHeightM={surfaceHeightM}
    />
  );
}

/**
 * Renders the six Surfaces that bound a Room (ADR-0008), plus every
 * Note Pinned to each Surface. Each Note is a child of its parent
 * Surface mesh so its transform inherits the Surface's world placement.
 *
 * - **Double-click empty wall** → creates a Note at the hit `(u, v)`
 * - **Drag a Note** (pointer-down + move) → window-level raycast against
 *   all six Surfaces re-Pins the Note to wherever the cursor is over a
 *   Surface (ADR-0010, issue #16)
 * - **Click a Note** (pointer-down + release without movement) → focus
 *   transition (issue #17), routed up through `onNoteClick` so the
 *   pre-focus Camera pose can be snapshotted from App.tsx.
 */
export function RoomScene({
  room,
  surfaces,
  notes,
  onNoteClick,
}: {
  room: Room;
  surfaces: readonly Surface[];
  notes: readonly Note[];
  onNoteClick: (noteId: string) => void;
}) {
  const createNoteAt = useAppStore((s) => s.createNoteAt);
  const drag = useAppStore((s) => s.drag);
  const setDragPin = useAppStore((s) => s.setDragPin);
  const setDragOverTrash = useAppStore((s) => s.setDragOverTrash);
  const dragOverTrash = useAppStore((s) => s.dragOverTrash);
  const endNoteDrag = useAppStore((s) => s.endNoteDrag);
  const currentTool = useAppStore((s) => s.penState.currentTool);
  const inProgressSurfaceId = useAppStore(
    (s) => s.penState.inProgressStroke?.surface_id ?? null,
  );
  const annotations = useAppStore((s) => s.annotations);
  const beginStroke = useAppStore((s) => s.beginStroke);
  const appendStrokePoint = useAppStore((s) => s.appendStrokePoint);
  const commitStroke = useAppStore((s) => s.commitStroke);
  const setPenHoverPoint = useAppStore((s) => s.setPenHoverPoint);
  const eraseStrokeAt = useAppStore((s) => s.eraseStrokeAt);

  const surfaceMeshes = useRef<Map<string, Mesh>>(new Map());
  const trashMeshRef = useRef<Mesh | null>(null);
  const [trashHovered, setTrashHovered] = useState(false);
  /** Wall clock at the start of the active Pen Stroke — used to compute
   *  `t` (ms since gesture started) for each appended point. */
  const penStrokeStart = useRef<number>(0);
  /** Surface id of the in-flight Eraser drag (issue #132), or null when
   *  not erasing. Separate from the pen's `inProgressStroke` — the eraser
   *  carries no in-progress Stroke; it just deletes whole Strokes under
   *  the cursor on down and on each move while the button is held. */
  const [erasingSurfaceId, setErasingSurfaceId] = useState<string | null>(null);
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new Raycaster(), []);

  // While a Note is being dragged, the window-level pointer move
  // raycasts against every Surface and pushes the live (surface_id, u, v)
  // into the store. Pointer-up commits via endNoteDrag.
  useEffect(() => {
    if (!drag) return;
    const dom = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      const ndc = new Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);

      // Trash bin first — if the cursor is over it, flag the drop as a
      // delete and skip the surface re-pin for this frame.
      if (trashMeshRef.current) {
        const trashHits = raycaster.intersectObject(
          trashMeshRef.current,
          false,
        );
        if (trashHits.length > 0) {
          setDragOverTrash(true);
          return;
        }
      }
      setDragOverTrash(false);

      const meshes = [...surfaceMeshes.current.values()];
      const hits = raycaster.intersectObjects(meshes, false);
      const hit = hits[0];
      if (!hit || !hit.uv) return;
      const surface_id = (hit.object.userData as { surface_id?: string })
        .surface_id;
      if (!surface_id) return;
      setDragPin({ surface_id, u: hit.uv.x, v: hit.uv.y });
    };
    const onUp = () => {
      void endNoteDrag();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, camera, gl, raycaster, setDragPin, setDragOverTrash, endNoteDrag]);

  // While a Pen Stroke is in progress, drive window-level pointermove
  // and pointerup. Raycast against the same Surface as the stroke
  // origin; ignore points that drift off the Surface. On release,
  // commit the stroke via the store (which writes it to the repo).
  useEffect(() => {
    if (!inProgressSurfaceId) return;
    const dom = gl.domElement;
    const startedAt = penStrokeStart.current;

    const onMove = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      const ndc = new Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const mesh = surfaceMeshes.current.get(inProgressSurfaceId);
      if (!mesh) return;
      const hits = raycaster.intersectObject(mesh, false);
      const hit = hits[0];
      if (!hit || !hit.uv) return;
      appendStrokePoint({
        u: hit.uv.x,
        v: hit.uv.y,
        p: e.pressure || 0.5,
        t: performance.now() - startedAt,
      });
    };
    const onUp = () => {
      void commitStroke();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [
    inProgressSurfaceId,
    camera,
    gl,
    raycaster,
    appendStrokePoint,
    commitStroke,
  ]);

  // While an Eraser drag is active, drive window-level pointermove and
  // pointerup (mirrors the in-progress-Stroke effect). Each move raycasts
  // the Surface the drag began on and erases whole Strokes under the
  // cursor; release ends the drag. Erasing is whole-Stroke (issue #132).
  useEffect(() => {
    if (!erasingSurfaceId) return;
    const dom = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      const ndc = new Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const mesh = surfaceMeshes.current.get(erasingSurfaceId);
      if (!mesh) return;
      const hits = raycaster.intersectObject(mesh, false);
      const hit = hits[0];
      if (!hit || !hit.uv) return;
      void eraseStrokeAt(erasingSurfaceId, hit.uv.x, hit.uv.y);
    };
    const onUp = () => setErasingSurfaceId(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [erasingSurfaceId, camera, gl, raycaster, eraseStrokeAt]);

  // While in Pen mode but NOT actively drawing, track the cursor's
  // wall hit so the 3D pen-cursor (PenCursor) follows the mouse from
  // the moment the user picks up the pen, instead of only appearing
  // once they pen-down (#35 follow-up).
  useEffect(() => {
    if (currentTool !== "pen") {
      setPenHoverPoint(null);
      return;
    }
    const dom = gl.domElement;
    const onMove = (e: PointerEvent) => {
      // The drawing effect above already drives points while a stroke
      // is in flight — don't double-track.
      if (inProgressSurfaceId) return;
      const rect = dom.getBoundingClientRect();
      const ndc = new Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const meshes = [...surfaceMeshes.current.values()];
      const hits = raycaster.intersectObjects(meshes, false);
      const hit = hits[0];
      if (!hit || !hit.uv) {
        setPenHoverPoint(null);
        return;
      }
      const surface_id = (hit.object.userData as { surface_id?: string })
        .surface_id;
      if (!surface_id) {
        setPenHoverPoint(null);
        return;
      }
      setPenHoverPoint({ surface_id, u: hit.uv.x, v: hit.uv.y });
    };
    dom.addEventListener("pointermove", onMove);
    return () => {
      dom.removeEventListener("pointermove", onMove);
      setPenHoverPoint(null);
    };
  }, [
    currentTool,
    inProgressSurfaceId,
    camera,
    gl,
    raycaster,
    setPenHoverPoint,
  ]);

  // Bucket annotations by surface for cheap per-Surface rendering.
  const annotationsBySurface = useMemo(() => {
    const m = new Map<string, typeof annotations>();
    for (const a of annotations) {
      const arr = m.get(a.surface_id);
      if (arr) arr.push(a);
      else m.set(a.surface_id, [a]);
    }
    return m;
  }, [annotations]);

  // Bucket notes by their effective surface_id (drag overrides the
  // persisted value so the Note follows the cursor across walls).
  const notesBySurface = useMemo(() => {
    const m = new Map<string, Note[]>();
    for (const n of notes) {
      const effective =
        drag?.noteId === n.id
          ? { ...n, surface_id: drag.surface_id, u: drag.u, v: drag.v }
          : n;
      const arr = m.get(effective.surface_id);
      if (arr) arr.push(effective);
      else m.set(effective.surface_id, [effective]);
    }
    return m;
  }, [notes, drag]);

  return (
    <group>
      {/* Trash bin on the floor — drag a Note onto it to delete. While
          a drag is active and the cursor is over this mesh, it gains
          a red emissive glow to signal "drop here to remove". */}
      <group
        position={TRASH_POSITION}
        onPointerEnter={(e) => {
          e.stopPropagation();
          setTrashHovered(true);
        }}
        onPointerLeave={() => setTrashHovered(false)}
      >
        <mesh
          ref={trashMeshRef}
          castShadow
          receiveShadow
          position={[0, 0.17, 0]}
        >
          <cylinderGeometry args={[0.16, 0.13, 0.34, 24, 1, true]} />
          <meshStandardMaterial
            color={dragOverTrash ? "#c8302c" : "#3a3a3a"}
            emissive={dragOverTrash ? "#c8302c" : "#000000"}
            emissiveIntensity={dragOverTrash ? 0.4 : 0}
            roughness={0.5}
            metalness={0.4}
            side={2}
          />
        </mesh>
        {/* A thin rim around the top edge for visual weight. */}
        <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
          <torusGeometry args={[0.16, 0.012, 8, 24]} />
          <meshStandardMaterial
            color="#2a2a2a"
            roughness={0.5}
            metalness={0.5}
          />
        </mesh>
        {/* A dark disc inside the bin (the "interior"). */}
        <mesh position={[0, 0.01, 0]} receiveShadow>
          <cylinderGeometry args={[0.13, 0.13, 0.005, 24]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
        </mesh>
        {/* HUD tooltip — hidden while a drag is in progress (the
            existing red glow already says "drop here") and in non-
            Note modes where the trash isn't useful. */}
        <HoverTooltip
          visible={trashHovered && currentTool === "note" && !drag}
          title="Trash"
          subtitle="Drag a Note here to delete"
          position={[0, 0.5, 0]}
        />
      </group>

      {surfaces.map((s) => {
        const t = surfaceTransform(
          s.kind,
          room.width_m,
          room.depth_m,
          room.height_m,
        );
        // Theme Customization (ADR-0022, issue #107): a non-default wall
        // Theme tints the walls via its catalog swatch. A null/absent or
        // default theme falls back to the Surface's palette base, so an
        // un-themed Room renders exactly as it did before customization.
        const themeItem = room.theme_id ? catalogItem(room.theme_id) : null;
        const themeSwatch =
          themeItem && themeItem.id !== defaultItemFor("theme").id
            ? themeItem.swatch
            : undefined;
        const color =
          isWall(s.kind) && themeSwatch
            ? themeSwatch
            : paletteEntry(s.color_id).base;
        const surfaceNotes = notesBySurface.get(s.id) ?? [];
        const acceptsNotes = isWall(s.kind);

        const onDoubleClick = (e: ThreeEvent<MouseEvent>) => {
          if (currentTool !== "note") return;
          if (!acceptsNotes) return;
          if (e.object.userData.kind !== "surface") return;
          if (!e.uv) return;
          if (e.object.userData.surface_id !== s.id) return;
          e.stopPropagation();
          void createNoteAt(s.id, e.uv.x, e.uv.y);
        };

        const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
          if (currentTool !== "pen" && currentTool !== "eraser") return;
          if (!e.uv) return;
          if (e.object.userData.kind !== "surface") return;
          if (e.object.userData.surface_id !== s.id) return;
          e.stopPropagation();
          if (currentTool === "eraser") {
            // Erase immediately under the cursor, then begin an erase drag
            // (the window-level effect erases on each move). Whole-Stroke
            // granularity (issue #132).
            void eraseStrokeAt(s.id, e.uv.x, e.uv.y);
            setErasingSurfaceId(s.id);
            return;
          }
          penStrokeStart.current = performance.now();
          beginStroke(s.id, {
            u: e.uv.x,
            v: e.uv.y,
            p: e.nativeEvent.pressure || 0.5,
            t: 0,
          });
        };

        const surfaceAnnotations = annotationsBySurface.get(s.id) ?? [];

        return (
          <mesh
            key={s.id}
            position={t.position}
            rotation={t.rotation}
            receiveShadow
            userData={{ kind: "surface", surface_id: s.id }}
            ref={(m) => {
              if (m) surfaceMeshes.current.set(s.id, m);
              else surfaceMeshes.current.delete(s.id);
            }}
            onDoubleClick={onDoubleClick}
            onPointerDown={onPointerDown}
          >
            <planeGeometry args={t.size} />
            <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
            {surfaceAnnotations.flatMap((a) =>
              a.strokes.map((stroke) => (
                <StrokeMesh
                  key={stroke.id}
                  stroke={stroke}
                  surfaceWidthM={t.size[0]}
                  surfaceHeightM={t.size[1]}
                />
              )),
            )}
            {/* The in-progress Stroke renders as a live preview on the
                Surface it began on. Committed Strokes above use the
                same renderer; this just feeds it the live points. */}
            {inProgressSurfaceId === s.id && (
              <InProgressStrokePreview
                surfaceWidthM={t.size[0]}
                surfaceHeightM={t.size[1]}
              />
            )}
            {/* PenCursor follows the cursor's wall hit any time the
                user is in Pen mode — whether actively drawing or just
                hovering after picking up the pen. The component
                itself decides whether to render based on whether this
                Surface owns the active stroke or the idle hover. */}
            {currentTool === "pen" && (
              <PenCursor
                surfaceId={s.id}
                surfaceWidthM={t.size[0]}
                surfaceHeightM={t.size[1]}
              />
            )}
            {surfaceNotes.map((n) => (
              <NoteMesh
                key={n.id}
                note={n}
                surfaceWidthM={t.size[0]}
                surfaceHeightM={t.size[1]}
                onClick={onNoteClick}
              />
            ))}
          </mesh>
        );
      })}
    </group>
  );
}
