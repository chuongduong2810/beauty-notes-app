import { useEffect, useState } from "react";
import { useSpring, animated } from "@react-spring/three";
import { createPaperTexture } from "../lib/note-paper-texture";
import { notebookCoverRotation } from "../lib/notebook-pose";
import { HoverTooltip } from "./HoverTooltip";

/**
 * A physical Notebook resting on the desk as permanent set-dressing
 * (CONTEXT.md, ADR-0016). Built from primitive geometries only (cover
 * boxes + a page stack + a spine) so it matches the perf footprint of
 * the rest of the room furniture — no GLTF, no per-instance textures
 * beyond the one shared paper CanvasTexture.
 *
 * Interaction (issue #56):
 *  - Hover  → pointer cursor + a HoverTooltip ("Notebook" / "Click to
 *    open"), exactly like the pen prop in RoomFurniture.tsx.
 *  - Click  → react-spring (ADR-0007) swings the front cover open and
 *    reveals two blank page planes (a left/right spread). Clicking the
 *    book again, pressing Escape, or clicking away closes it.
 *
 * The page *content* is a separate concern (issue #57) — this file
 * only delivers the object and the open/close motion, leaving clearly
 * marked anchor groups on each open page for #57 to mount its content.
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

export function Notebook() {
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
  const { coverAngle, lift } = useSpring({
    coverAngle: notebookCoverRotation(open),
    // Small +Y "settle" — the book nudges up a touch as it opens then
    // sits back down, selling the heft of the cover.
    lift: open ? 0.006 : 0,
    config: { tension: 120, friction: 16 },
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

      <animated.group position-x={BOOK_POSITION[0]} position-z={BOOK_POSITION[2]} position-y={lift.to((l) => BOOK_POSITION[1] + l)}>
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

        {/* Open spread — two blank page planes + content anchors for
            #57. Only mounted while open. The planes face up (rotated
            flat) just above the page stack; the left page lies where
            the swung-open front cover now sits, the right page over the
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

            {/* Content mount points for the open spread. #57 will mount
                <Html transform> page content into these anchors, one per
                page. Positioned a hair above each page plane (+Y) so the
                content floats on the paper, not z-fighting with it. */}
            {/* TODO(#57): mount page content here (left page). */}
            <group name="notebook-page-left" position={[-BOOK_WIDTH / 2, 0.001, 0]} />
            {/* TODO(#57): mount page content here (right page). */}
            <group name="notebook-page-right" position={[BOOK_WIDTH / 2, 0.001, 0]} />
          </group>
        )}

        {/* Hover toast above the book — same futuristic HUD card as the
            pen prop. */}
        <HoverTooltip
          visible={hovered}
          title="Notebook"
          subtitle="Click to open"
          position={[0, 0.12, 0]}
        />
      </animated.group>
    </>
  );
}
