import { useEffect, useMemo, useState } from "react";
import { useSpring, animated } from "@react-spring/three";
import { Html } from "@react-three/drei";
import { createPaperTexture } from "../lib/note-paper-texture";
import { notebookCoverRotation } from "../lib/notebook-pose";
import {
  buildNotebookSections,
  noteSnippet,
  NOTEBOOK_SECTION_KEYS,
  NOTEBOOK_SECTION_TITLES,
  type NotebookSectionKey,
} from "../lib/notebook-sections";
import { paletteEntry } from "../lib/palette";
import { useAppStore } from "../store";
import { HoverTooltip } from "./HoverTooltip";

/**
 * A physical Notebook resting on the desk as permanent set-dressing
 * (CONTEXT.md, ADR-0016). Built from primitive geometries only (cover
 * boxes + a page stack + a spine) so it matches the perf footprint of
 * the rest of the room furniture — no GLTF, no per-instance textures
 * beyond the one shared paper CanvasTexture.
 *
 * Interaction:
 *  - Hover  → pointer cursor + a HoverTooltip ("Notebook" / "Click to
 *    open"), exactly like the pen prop in RoomFurniture.tsx.
 *  - Click  → react-spring (ADR-0007) swings the front cover open and
 *    reveals two page planes (a left/right spread). Clicking the book
 *    again, pressing Escape, or clicking away closes it.
 *
 * Open, the spread is an *index into the current Room's existing Notes*
 * (issue #57): the left page is the three section tabs (Recently
 * Created / Recently Edited / Bookmarked); the right page lists that
 * section's Notes. Page content rides on the pages via drei
 * `<Html transform>` (ADR-0016) — the same overlay family as
 * HoverTooltip — laid flat on the paper so it reads as written-on
 * pages rather than a floating UI panel. Selecting an entry closes the
 * book and navigates the Camera to that Note via the parent's
 * `onSelectNote` (a Focus transition + a brief highlight pulse).
 *
 * Placement assumes the default Room (6 × 6 × 3 m), like the rest of
 * RoomFurniture: the desk top sits at world y≈0.77, so the closed book
 * lies flat at world [-0.45, 0.79, -2.15], clear of the pen prop at
 * [0.55, 0.772, -2.05]. If Rooms become resizable later this will need
 * to scale/move with the desk.
 */

// One shared procedural paper texture for the page sheets + open pages,
// built once at module load (no-op / null in non-DOM test envs). Same
// pattern as NoteMesh.
const PAPER_TEXTURE = createPaperTexture();

const COVER_COLOR = "#7a4a2b"; // warm leather-brown cover
const SPINE_COLOR = "#653b22"; // slightly darker spine
const PAGE_COLOR = "#f4ecd8"; // cream paper edges

// Book footprint (metres) — about a 21 × 28 cm hardback lying flat.
const BOOK_WIDTH = 0.22; // along world +X (the open spread spans 2×)
const BOOK_DEPTH = 0.28; // along world +Z (front-to-back of the desk)
const COVER_THICKNESS = 0.012;
const PAGE_STACK_HEIGHT = 0.03;

// World pose of the closed book on the desk (see file docstring).
const BOOK_POSITION: [number, number, number] = [-0.45, 0.79, -2.15];

/**
 * drei `<Html transform>` perspective-scale for the page content. Sized
 * so the fixed-px page DOM (150 × 196) fills ~90% of each ~0.2 m page
 * rather than floating small in the middle of it. Tunable by eye —
 * lower = smaller content on the page.
 */
const PAGE_HTML_DISTANCE = 0.3;

/**
 * Open "reading pose" (issue #57 follow-up). Flat on the desk the open
 * pages are viewed almost edge-on at eye-level orbit and are hard to
 * read. So on open the whole book lifts off the desk and tilts up to
 * face the viewer — as if picked up to read — then settles back flat on
 * close. Kept as a fixed tilt toward the default south-facing view
 * (rather than a camera billboard) so it still reads as a physical book.
 */
const READING_TILT_RAD = 1.0; // ~57° — pages face up-and-toward the viewer
const READING_LIFT_M = 0.22; // rises off the desk so the near edge clears it
const READING_FORWARD_M = 0.06; // eases a touch toward the viewer (+Z, south)

/** Relative "time ago" label for an ISO timestamp. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

/**
 * The open-spread page content (left tabs + right list), rendered on the
 * paper via `<Html transform>`. Kept inside Notebook so it only mounts
 * while the book is open.
 */
function NotebookSpread({
  onSelectNote,
}: {
  onSelectNote: (noteId: string) => void;
}) {
  const notes = useAppStore((s) => s.notes);
  const sections = useMemo(() => buildNotebookSections(notes), [notes]);
  const [section, setSection] = useState<NotebookSectionKey>("recentlyCreated");

  const entries = sections[section];
  const sectionIndex = NOTEBOOK_SECTION_KEYS.indexOf(section);

  const turn = (dir: 1 | -1) => {
    const next =
      (sectionIndex + dir + NOTEBOOK_SECTION_KEYS.length) %
      NOTEBOOK_SECTION_KEYS.length;
    setSection(NOTEBOOK_SECTION_KEYS[next]);
  };

  const emptyMessage =
    section === "bookmarked"
      ? "Bookmark a note to keep it here."
      : "No notes yet — double-click a wall to pin one.";

  return (
    <group position={[0, COVER_THICKNESS + PAGE_STACK_HEIGHT + 0.003, 0]}>
      {/* Left page — section tabs. `center` anchors the card by its
          middle at the page centre (without it the DOM top-left lands on
          the anchor and the card sits down-and-right of centre). */}
      <Html
        transform
        center
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-BOOK_WIDTH / 2, 0.001, 0]}
        distanceFactor={PAGE_HTML_DISTANCE}
        zIndexRange={[60, 0]}
        pointerEvents="auto"
      >
        <div className="notebook-page notebook-page--left">
          <div className="notebook-page__brand">Notebook</div>
          <div className="notebook-tabs">
            {NOTEBOOK_SECTION_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={
                  "notebook-tab" +
                  (key === section ? " notebook-tab--active" : "")
                }
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setSection(key)}
              >
                {NOTEBOOK_SECTION_TITLES[key]}
                <span className="notebook-tab__count">
                  {sections[key].length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Html>

      {/* Right page — the current section's Notes. Keyed by section so
          switching tabs remounts the list and replays the page-turn
          flip animation (CSS in index.html). */}
      <Html
        transform
        center
        rotation={[-Math.PI / 2, 0, 0]}
        position={[BOOK_WIDTH / 2, 0.001, 0]}
        distanceFactor={PAGE_HTML_DISTANCE}
        zIndexRange={[60, 0]}
        pointerEvents="auto"
      >
        <div className="notebook-page notebook-page--right">
          <div className="notebook-page__title">
            {NOTEBOOK_SECTION_TITLES[section]}
          </div>
          <div key={section} className="notebook-list notebook-list--flip">
            {entries.length === 0 ? (
              <div className="notebook-empty">{emptyMessage}</div>
            ) : (
              entries.map((n) => {
                const pal = paletteEntry(n.color_id);
                return (
                  <button
                    key={n.id}
                    type="button"
                    className="notebook-entry"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onSelectNote(n.id)}
                  >
                    <span
                      className="notebook-entry__swatch"
                      style={{ background: pal.base }}
                    />
                    <span className="notebook-entry__text">
                      {noteSnippet(n.body)}
                    </span>
                    <span className="notebook-entry__time">
                      {timeAgo(n.updated_at)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {/* Page-turn affordance between sections. */}
          <div className="notebook-pageturn">
            <button
              type="button"
              className="notebook-pageturn__btn"
              aria-label="Previous section"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => turn(-1)}
            >
              ‹
            </button>
            <span className="notebook-pageturn__dots">
              {NOTEBOOK_SECTION_KEYS.map((key, i) => (
                <span
                  key={key}
                  className={
                    "notebook-pageturn__dot" +
                    (i === sectionIndex ? " notebook-pageturn__dot--on" : "")
                  }
                />
              ))}
            </span>
            <button
              type="button"
              className="notebook-pageturn__btn"
              aria-label="Next section"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => turn(1)}
            >
              ›
            </button>
          </div>
        </div>
      </Html>
    </group>
  );
}

export function Notebook({
  onSelectNote,
}: {
  /** Navigate the Camera to a Note picked from the Notebook — snapshots
   *  the orbit pose and runs a Focus transition + highlight (issue #57).
   *  Owned by App.tsx so the camera-pose math isn't duplicated. */
  onSelectNote: (noteId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Escape closes the open book — mirrors the focus/editor escape
  // affordances elsewhere in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // react-spring drives the cover hinge angle. A gentle wobble settle
  // (low tension / moderate friction) so the cover swings open and
  // eases to rest rather than snapping.
  const { coverAngle, tilt, riseY, forwardZ } = useSpring({
    coverAngle: notebookCoverRotation(open),
    // Lift + tilt the whole book up to face the viewer while open so the
    // pages are readable, not viewed edge-on flat on the desk.
    tilt: open ? READING_TILT_RAD : 0,
    riseY: open ? READING_LIFT_M : 0,
    forwardZ: open ? READING_FORWARD_M : 0,
    config: { tension: 120, friction: 18 },
  });

  const onOver = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  };
  const onOut = () => {
    setHovered(false);
    document.body.style.cursor = "";
  };
  const onClickBook = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setOpen((o) => !o);
  };

  // Selecting a Note closes the book, then navigates to it. Close first
  // so the camera flight isn't framed through the open spread.
  const handleSelect = (noteId: string) => {
    setOpen(false);
    onSelectNote(noteId);
  };

  // Spine hinge sits along the book's back-left edge (world -X side of
  // the spread) so the front cover swings open to the left, revealing
  // the right page where it rested and the left page underneath.
  const hingeX = -BOOK_WIDTH / 2;
  const coverTopY = PAGE_STACK_HEIGHT / 2 + COVER_THICKNESS / 2;

  return (
    <>
      {/* Invisible click-away catcher: a large plane just above the
          desk that closes the book when the user clicks empty space.
          Only mounted while open so it never blocks other props. */}
      {open && (
        <mesh
          position={[BOOK_POSITION[0], BOOK_POSITION[1] + 0.001, BOOK_POSITION[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <planeGeometry args={[6, 6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      <animated.group
        position-x={BOOK_POSITION[0]}
        position-y={riseY.to((y) => BOOK_POSITION[1] + y)}
        position-z={forwardZ.to((z) => BOOK_POSITION[2] + z)}
        // Tilt the near (front, +Z) edge down / far edge up so the open
        // pages face up-and-toward the viewer (see READING_TILT_RAD).
        rotation-x={tilt}
      >
        {/* Hover handlers wrap the whole book so they fire on any of
            its primitive meshes (same shape as the pen block). */}
        <group
          onPointerOver={onOver}
          onPointerOut={onOut}
          onPointerDown={onClickBook}
        >
          {/* Back cover — lies flat under everything. */}
          <mesh castShadow receiveShadow position={[0, COVER_THICKNESS / 2, 0]}>
            <boxGeometry args={[BOOK_WIDTH, COVER_THICKNESS, BOOK_DEPTH]} />
            <meshStandardMaterial color={COVER_COLOR} roughness={0.7} metalness={0.05} />
          </mesh>

          {/* Page stack — cream block of sheets between the covers. */}
          <mesh
            castShadow
            receiveShadow
            position={[0, COVER_THICKNESS + PAGE_STACK_HEIGHT / 2, 0]}
          >
            <boxGeometry
              args={[BOOK_WIDTH * 0.96, PAGE_STACK_HEIGHT, BOOK_DEPTH * 0.96]}
            />
            <meshStandardMaterial
              color={PAGE_COLOR}
              map={PAPER_TEXTURE ?? undefined}
              roughness={0.95}
              metalness={0}
            />
          </mesh>

          {/* Spine — runs along the back-left hinge edge, tying the two
              covers together. */}
          <mesh
            castShadow
            receiveShadow
            position={[hingeX, COVER_THICKNESS + PAGE_STACK_HEIGHT / 2, 0]}
          >
            <boxGeometry
              args={[COVER_THICKNESS, PAGE_STACK_HEIGHT + COVER_THICKNESS * 2, BOOK_DEPTH]}
            />
            <meshStandardMaterial color={SPINE_COLOR} roughness={0.7} metalness={0.05} />
          </mesh>

          {/* Front cover — hinged at the spine. Closed it lies flat on
              the page stack; react-spring rotates it about the spine
              (world +Z axis) to swing it open. Modelled as a child of a
              group pivoted at the hinge so the rotation is about the
              spine edge, not the cover's centre. */}
          <animated.group
            position={[hingeX, COVER_THICKNESS + PAGE_STACK_HEIGHT, 0]}
            rotation-z={coverAngle}
          >
            <mesh
              castShadow
              receiveShadow
              position={[BOOK_WIDTH / 2, coverTopY, 0]}
            >
              <boxGeometry args={[BOOK_WIDTH, COVER_THICKNESS, BOOK_DEPTH]} />
              <meshStandardMaterial color={COVER_COLOR} roughness={0.7} metalness={0.05} />
            </mesh>
          </animated.group>
        </group>

        {/* Open spread — two page planes + the index content (issue #57).
            Only mounted while open. The planes face up (rotated flat)
            just above the page stack; the left page lies where the
            swung-open front cover now sits, the right page over the
            stack itself. */}
        {open && (
          <group position={[0, COVER_THICKNESS + PAGE_STACK_HEIGHT + 0.002, 0]}>
            {/* Left page (under the opened cover, world -X half). */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-BOOK_WIDTH / 2, 0, 0]}>
              <planeGeometry args={[BOOK_WIDTH * 0.94, BOOK_DEPTH * 0.94]} />
              <meshStandardMaterial
                color={PAGE_COLOR}
                map={PAPER_TEXTURE ?? undefined}
                roughness={0.95}
                metalness={0}
              />
            </mesh>
            {/* Right page (over the stack, world +X half). */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[BOOK_WIDTH / 2, 0, 0]}>
              <planeGeometry args={[BOOK_WIDTH * 0.94, BOOK_DEPTH * 0.94]} />
              <meshStandardMaterial
                color={PAGE_COLOR}
                map={PAPER_TEXTURE ?? undefined}
                roughness={0.95}
                metalness={0}
              />
            </mesh>
          </group>
        )}

        {/* The page index content rides on the open spread via
            <Html transform> (ADR-0016). Mounted separately so its own
            section state is scoped to one open session. */}
        {open && <NotebookSpread onSelectNote={handleSelect} />}

        {/* Hover toast above the book — same futuristic HUD card as the
            pen prop. */}
        <HoverTooltip
          visible={hovered && !open}
          title="Notebook"
          subtitle="Click to open"
          position={[0, 0.12, 0]}
        />
      </animated.group>
    </>
  );
}
