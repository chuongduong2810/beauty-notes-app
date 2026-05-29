import { useMemo } from "react";
import {
  AlwaysStencilFunc,
  BackSide,
  EqualStencilFunc,
  ReplaceStencilOp,
} from "three";
import {
  DEFAULT_ROOM_WIDTH_M,
  DEFAULT_ROOM_DEPTH_M,
  DEFAULT_ROOM_HEIGHT_M,
} from "../lib/room";
import {
  buildingLayout,
  windowPlacement,
  CITY_DEPTH_LAYERS,
} from "../lib/city-layout";

/**
 * Window + City set-dressing for the west wall (issue #42, ADR-0015).
 *
 * A sibling of `RoomFurniture`: primitive geometry only (boxes + planes),
 * no GLTF, no heavy textures. It mounts three things in front of / beyond
 * `wall_west`:
 *
 *  1. A window frame + a translucent glass pane, sitting just inside the
 *     wall plane as decoration (NOT a Surface, not persisted — ADR-0015).
 *  2. A procedural City skyline of primitive boxes living OUTSIDE the Room
 *     volume, beyond the west wall, across several depth layers so orbiting
 *     the Camera produces real parallax.
 *  3. A large sky backdrop behind the skyline so the view through the glass
 *     never shows the flat clear-colour seam, plus distance fog that fades
 *     the far buildings into the dusk sky.
 *
 * **Seeing through an opaque wall.** `wall_west` is a solid, opaque
 * Surface plane owned by `RoomScene`; we must not touch it. To reveal the
 * City through the window without modifying the wall, the window opening
 * writes a value into the STENCIL buffer, and the City + sky render only
 * where that stencil matches — painting over the wall *inside the opening
 * only*. The wall stays opaque everywhere else. The City contents render
 * with `depthTest` off and an explicit painter order (sky furthest back,
 * then each parallax layer near→far) so the skyline layers correctly over
 * the wall it is masking, while still moving with real 3D parallax as the
 * Camera orbits.
 *
 * Positions are hard-coded to the default Room (6 × 6 × 3 m), exactly as
 * `RoomFurniture` is. If Rooms ever become resizable, swap these constants
 * for `room.width_m / depth_m / height_m` — the layout helpers in
 * `city-layout.ts` already take those dimensions as arguments.
 *
 * Every mesh here disables raycasting (`NO_RAYCAST`): the glass + frame sit
 * directly in front of `wall_west`, and if they intercepted pointer rays
 * they would steal double-clicks / pen-downs meant for the wall and block
 * Note placement over the glass. With raycasting off, Notes Pin anywhere
 * on `wall_west`, including over the glass (no regression to note / pen).
 */

// --- Hard-coded to the default 6 × 6 × 3 m Room (see docstring). ---
const ROOM_W = DEFAULT_ROOM_WIDTH_M;
const ROOM_D = DEFAULT_ROOM_DEPTH_M;
const ROOM_H = DEFAULT_ROOM_HEIGHT_M;

/** West wall plane X (the Room boundary); the City lives beyond this. */
const WEST_WALL_X = -ROOM_W / 2;

/** Three.js default Mesh.raycast / a no-op, mirroring PenProp's pattern.
 *  Assigning `undefined` to `raycast` shadows the prototype and throws on
 *  the next cast, so we assign a noop instead. */
const NO_RAYCAST = () => null;

/** Stencil ref the window opening writes and the City reads through. */
const PORTAL_STENCIL_REF = 7;

/** Render-order bands. Higher draws later (on top). The window opening
 *  must write its stencil before any City content reads it. */
const ORDER_PORTAL_MASK = 0;
const ORDER_SKY = 1;
const ORDER_BUILDINGS_BASE = 2; // + (lastLayer - depthLayer): near draws last

/** Frame profile thickness/depth (metres). */
const FRAME_THICKNESS = 0.12;
const FRAME_DEPTH = 0.1;

/** Dusk-sky / fog colour the far skyline fades into. */
const SKY_COLOR = "#2a2440";
const GLASS_TINT = "#bcd2e0";
const FRAME_COLOR = "#1a1620";

/** Deterministic, calm palette for the building boxes. */
const BUILDING_PALETTE = ["#23202e", "#2b2740", "#1d1b28", "#322c46", "#262236"];

export function CityView() {
  const buildings = useMemo(() => buildingLayout(ROOM_W), []);
  const win = useMemo(() => windowPlacement(ROOM_W, ROOM_D, ROOM_H), []);

  const halfW = win.width / 2;
  const halfH = win.height / 2;

  return (
    <group>
      {/* Distance fog: starts well beyond the Room interior so the room
          itself stays crisp, and fades the far skyline into the dusk sky
          (so the backdrop never shows a flat clear-colour seam). */}
      <fog attach="fog" args={[SKY_COLOR, 6, 34]} />

      {/* --- Window assembly on wall_west. The wall sits at x = -W/2
          facing +X (into the Room). Local frame after the +90° Y rotation:
          local X runs along the Room's depth (world Z), local Y is up,
          local Z points toward the Room interior (+X world). --- */}
      <group
        position={[WEST_WALL_X, win.center[1], win.center[0]]}
        rotation={[0, Math.PI / 2, 0]}
      >
        {/* Portal mask: an invisible pane filling the opening that writes
            PORTAL_STENCIL_REF into the stencil buffer. No colour, no depth
            — it only marks the screen region where the City may show. Sits
            a hair in front of the wall so it isn't z-rejected by it. */}
        <mesh
          position={[0, 0, 0.015]}
          renderOrder={ORDER_PORTAL_MASK}
          raycast={NO_RAYCAST}
        >
          <planeGeometry args={[win.width, win.height]} />
          <meshBasicMaterial
            colorWrite={false}
            depthWrite={false}
            stencilWrite
            stencilRef={PORTAL_STENCIL_REF}
            stencilFunc={AlwaysStencilFunc}
            stencilZPass={ReplaceStencilOp}
          />
        </mesh>

        {/* Translucent glass pane in front of the opening — sells the
            "there is glass here" read with a faint tint + specular. */}
        <mesh position={[0, 0, 0.025]} raycast={NO_RAYCAST}>
          <planeGeometry args={[win.width, win.height]} />
          <meshStandardMaterial
            color={GLASS_TINT}
            transparent
            opacity={0.1}
            roughness={0.05}
            metalness={0.1}
          />
        </mesh>

        {/* Frame: four bars around the opening + a muntin cross. All boxes,
            all inert to the raycaster. */}
        {([halfH, -halfH] as const).map((y) => (
          <mesh
            key={`h${y}`}
            position={[0, y, FRAME_DEPTH / 2]}
            raycast={NO_RAYCAST}
            castShadow
          >
            <boxGeometry
              args={[win.width + FRAME_THICKNESS, FRAME_THICKNESS, FRAME_DEPTH]}
            />
            <meshStandardMaterial color={FRAME_COLOR} roughness={0.7} />
          </mesh>
        ))}
        {([halfW, -halfW] as const).map((x) => (
          <mesh
            key={`v${x}`}
            position={[x, 0, FRAME_DEPTH / 2]}
            raycast={NO_RAYCAST}
            castShadow
          >
            <boxGeometry args={[FRAME_THICKNESS, win.height, FRAME_DEPTH]} />
            <meshStandardMaterial color={FRAME_COLOR} roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 0, FRAME_DEPTH / 2]} raycast={NO_RAYCAST}>
          <boxGeometry
            args={[FRAME_THICKNESS * 0.5, win.height, FRAME_DEPTH * 0.7]}
          />
          <meshStandardMaterial color={FRAME_COLOR} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, FRAME_DEPTH / 2]} raycast={NO_RAYCAST}>
          <boxGeometry
            args={[win.width, FRAME_THICKNESS * 0.5, FRAME_DEPTH * 0.7]}
          />
          <meshStandardMaterial color={FRAME_COLOR} roughness={0.7} />
        </mesh>
      </group>

      {/* --- City + sky: rendered in world space OUTSIDE the Room, masked
          to the window opening by the stencil. depthTest is off so the
          opaque wall (closer to the camera) doesn't reject them; explicit
          renderOrder gives correct painter-ordering instead. --- */}

      {/* Sky backdrop: a large inward-facing sphere far behind the skyline
          so the opening is always sky, never the flat clear-colour seam. */}
      <mesh
        position={[WEST_WALL_X - 45, 0, 0]}
        renderOrder={ORDER_SKY}
        raycast={NO_RAYCAST}
      >
        <sphereGeometry args={[70, 24, 16]} />
        <meshBasicMaterial
          color={SKY_COLOR}
          side={BackSide}
          fog
          depthTest={false}
          depthWrite={false}
          stencilWrite
          stencilRef={PORTAL_STENCIL_REF}
          stencilFunc={EqualStencilFunc}
        />
      </mesh>

      {/* Skyline boxes. Painter order: far layers first, near layers last,
          so nearer buildings draw over farther ones without depthTest. */}
      {buildings.map((b, i) => (
        <mesh
          key={i}
          position={b.position}
          renderOrder={
            ORDER_BUILDINGS_BASE + (CITY_DEPTH_LAYERS - 1 - b.depthLayer)
          }
          raycast={NO_RAYCAST}
        >
          <boxGeometry args={b.size} />
          <meshStandardMaterial
            color={BUILDING_PALETTE[b.colorIndex % BUILDING_PALETTE.length]}
            roughness={0.95}
            metalness={0}
            emissive={SKY_COLOR}
            emissiveIntensity={0.1}
            fog
            depthTest={false}
            depthWrite={false}
            stencilWrite
            stencilRef={PORTAL_STENCIL_REF}
            stencilFunc={EqualStencilFunc}
          />
        </mesh>
      ))}
    </group>
  );
}
