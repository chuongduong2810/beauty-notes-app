import { useMemo } from "react";
import { RenderTexture, PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import {
  DEFAULT_ROOM_WIDTH_M,
  DEFAULT_ROOM_DEPTH_M,
  DEFAULT_ROOM_HEIGHT_M,
} from "../lib/room";
import { buildingLayout, windowPlacement } from "../lib/city-layout";
import { rainStreakLayout, scrollOffset } from "../lib/rain-streaks";
import { CityRain } from "./CityRain";

/**
 * Window + City set-dressing for the west wall (issue #42, ADR-0015).
 *
 * A sibling of `RoomFurniture`: primitive geometry only (boxes + planes),
 * no GLTF, no heavy textures. It mounts a framed Window on `wall_west` whose
 * glass shows a procedural City skyline that lives OUTSIDE the Room volume.
 *
 * **Why render-to-texture (and not a stencil portal).** `wall_west` is a
 * solid, opaque Surface owned by `RoomScene` that we must not modify, so the
 * City — which sits beyond the wall — cannot simply be drawn into the main
 * scene: the wall would occlude it. The first implementation tried a stencil
 * portal (`depthTest:false` City masked to the opening), but the scene is
 * rendered through the postprocessing `EffectComposer` (Bloom/DOF/SSAO),
 * whose render targets carry NO stencil buffer. The stencil test then passed
 * everywhere and the depth-less City painted over the whole Room.
 *
 * Instead we render the City + sky as an isolated sub-scene into a texture
 * (drei `RenderTexture`) and map that onto the glass pane. The texture is
 * confined to the pane quad by construction — it can never paint over the
 * Room or poke past the frame — and a 3D-rendered skyline still reads with
 * real depth and scale. The sub-scene has its own camera, lights and fog,
 * independent of the Room's lighting.
 *
 * Positions are hard-coded to the default Room (6 × 6 × 3 m), exactly as
 * `RoomFurniture` is. If Rooms ever become resizable, swap these constants
 * for `room.width_m / depth_m / height_m` — the layout helpers in
 * `city-layout.ts` already take those dimensions as arguments.
 *
 * Every mesh disables raycasting (`NO_RAYCAST`): the glass + frame sit
 * directly in front of `wall_west`, and if they intercepted pointer rays
 * they would steal double-clicks / pen-downs meant for the wall. With
 * raycasting off, Notes Pin anywhere on `wall_west`, including over the
 * glass (no regression to note / pen).
 */

// --- Hard-coded to the default 6 × 6 × 3 m Room (see docstring). ---
const ROOM_W = DEFAULT_ROOM_WIDTH_M;
const ROOM_D = DEFAULT_ROOM_DEPTH_M;
const ROOM_H = DEFAULT_ROOM_HEIGHT_M;

/** West wall plane X (the Room boundary); the City lives beyond this. */
const WEST_WALL_X = -ROOM_W / 2;

/** Three.js default Mesh.raycast / a no-op, mirroring PenProp's pattern. */
const NO_RAYCAST = () => null;

/** Frame profile thickness/depth (metres). */
const FRAME_THICKNESS = 0.12;
const FRAME_DEPTH = 0.1;

/** Dusk-sky / fog colour the far skyline fades into. */
const SKY_COLOR = "#3a3358";
const GROUND_COLOR = "#16131f";
const GLASS_TINT = "#bcd2e0";
const FRAME_COLOR = "#1a1620";

/** Deterministic, calm palette for the building boxes. */
const BUILDING_PALETTE = ["#23202e", "#2b2740", "#1d1b28", "#322c46", "#262236"];
/** Warm "lit window" emissive so the dusk skyline glows a little. */
const BUILDING_EMISSIVE = "#e8c98a";

/** Seed for the deterministic on-glass rain-streak layout (issue #44). */
const RAIN_STREAK_SEED = 0x9173;
/** Texture resolution for the procedural streak alpha map. */
const STREAK_TEX_SIZE = 512;

/**
 * Procedurally draw the on-glass rain-streak texture (issue #44, ADR-0015).
 *
 * Like `note-paper-texture.ts`, this builds a `<canvas>` (no image asset
 * files) and returns a single shared `CanvasTexture`. The texture is a
 * white-on-transparent set of soft vertical droplet trails laid out by the
 * pure {@link rainStreakLayout}; it is used as a low-opacity overlay so the
 * City stays clearly visible behind it. `RepeatWrapping` on the T axis lets
 * the consumer scroll it downward seamlessly via `texture.offset`.
 *
 * Returns `null` in non-DOM environments (vitest, SSR), matching the
 * codebase's nullable-texture convention.
 */
function createRainStreakTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = STREAK_TEX_SIZE;
  canvas.height = STREAK_TEX_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Fully transparent base — only the trails contribute, so the overlay
  // material shows the City everywhere except along the thin streaks.
  ctx.clearRect(0, 0, STREAK_TEX_SIZE, STREAK_TEX_SIZE);

  for (const s of rainStreakLayout(RAIN_STREAK_SEED)) {
    const x = s.x * STREAK_TEX_SIZE;
    const lengthPx = s.length * STREAK_TEX_SIZE;
    // Anchor each trail at a deterministic vertical position derived from
    // its x, so streaks don't all start at the same row. (Scrolling the
    // whole texture animates them together regardless of start.)
    const startY = ((s.x * 1.37) % 1) * STREAK_TEX_SIZE;
    const endY = startY + lengthPx;
    const widthPx = Math.max(1, s.width * STREAK_TEX_SIZE);

    // A vertical trail that fades from a brighter "head" droplet to a
    // faint tail — reads as water sliding down the glass.
    const grad = ctx.createLinearGradient(0, startY, 0, endY);
    grad.addColorStop(0, `rgba(255, 255, 255, 0)`);
    grad.addColorStop(0.15, `rgba(255, 255, 255, ${s.opacity})`);
    grad.addColorStop(1, `rgba(255, 255, 255, 0)`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = widthPx;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();

    // Brighter rounded "head" droplet at the leading edge.
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, s.opacity * 1.6)})`;
    ctx.beginPath();
    ctx.arc(x, startY, widthPx * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

/** Scroll speed of the whole streak texture (cycles per second) — slow. */
const STREAK_SCROLL_SPEED = 0.04;

/**
 * Animated rain-streak overlay pane (issue #44).
 *
 * A transparent pane that sits just in front of the glass sheen within the
 * Window opening. Its procedural streak texture scrolls downward each frame
 * via {@link scrollOffset}, so the droplet trails appear to run down the
 * glass. Kept deliberately subtle (low per-streak opacity, additive over
 * the City) so the skyline stays clearly visible. `meshBasicMaterial` so the
 * dim Room light never darkens it, and `NO_RAYCAST` so it never steals
 * double-clicks / pen meant for `wall_west` (Notes still Pin over the glass).
 */
function RainStreakOverlay({
  width,
  height,
  zOffset,
}: {
  width: number;
  height: number;
  zOffset: number;
}) {
  const texture = useMemo(() => createRainStreakTexture(), []);

  useFrame((state) => {
    if (!texture) return;
    // Scroll the texture downward. offset.y increasing moves the sampled
    // region up, so the trails read as moving down the pane.
    texture.offset.y = scrollOffset(state.clock.elapsedTime, STREAK_SCROLL_SPEED);
  });

  if (!texture) return null;

  return (
    <mesh position={[0, 0, zOffset]} raycast={NO_RAYCAST}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </mesh>
  );
}

export function CityView() {
  const buildings = useMemo(() => buildingLayout(ROOM_W), []);
  const win = useMemo(() => windowPlacement(ROOM_W, ROOM_D, ROOM_H), []);

  const halfW = win.width / 2;
  const halfH = win.height / 2;
  const aspect = win.width / win.height;
  const texHeight = Math.round(1024 / aspect);
  // Eye level of the Window in world Y — the sub-scene camera looks out
  // from here, level with the horizon.
  const eyeY = win.center[1];

  return (
    <group>
      {/* Window assembly on wall_west. The wall sits at x = -W/2 facing +X
          (into the Room). After the +90° Y rotation: local X runs along the
          Room's depth (world Z), local Y is up, local Z points toward the
          Room interior (+X world). */}
      <group
        position={[WEST_WALL_X, win.center[1], win.center[0]]}
        rotation={[0, Math.PI / 2, 0]}
      >
        {/* The "view": a pane filling the opening, just in front of the
            wall, textured with the City sub-scene. meshBasicMaterial so the
            already-lit skyline isn't darkened again by the dim Room. */}
        <mesh position={[0, 0, 0.02]} raycast={NO_RAYCAST}>
          <planeGeometry args={[win.width, win.height]} />
          <meshBasicMaterial>
            <RenderTexture attach="map" width={1024} height={texHeight}>
              <PerspectiveCamera
                makeDefault
                manual
                aspect={aspect}
                fov={52}
                near={0.1}
                far={80}
                position={[WEST_WALL_X, eyeY, 0]}
                rotation={[0, Math.PI / 2, 0]}
              />
              {/* Dusk sky fills the frame edge-to-edge; matching fog fades
                  the far skyline into it (no flat seam, real depth cue). */}
              <color attach="background" args={[SKY_COLOR]} />
              <fog attach="fog" args={[SKY_COLOR, 12, 60]} />
              <ambientLight intensity={0.6} color="#9fb0d8" />
              <directionalLight
                position={[-1, 0.6, 0.3]}
                intensity={0.8}
                color="#cdd6f0"
              />
              {/* Ground so buildings sit on a horizon rather than float. */}
              <mesh
                position={[WEST_WALL_X - 40, 0, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry args={[120, 120]} />
                <meshStandardMaterial color={GROUND_COLOR} roughness={1} />
              </mesh>
              {buildings.map((b, i) => (
                <mesh key={i} position={b.position}>
                  <boxGeometry args={b.size} />
                  <meshStandardMaterial
                    color={BUILDING_PALETTE[b.colorIndex % BUILDING_PALETTE.length]}
                    roughness={0.9}
                    metalness={0}
                    emissive={BUILDING_EMISSIVE}
                    emissiveIntensity={0.12}
                  />
                </mesh>
              ))}
              {/* Falling rain (issue #43) — the Weather's rain layer, inside
                  this RTT sub-scene so it reads through the glass and never
                  enters the Room. Confined to a slab beyond the west wall. */}
              <CityRain roomWidthM={ROOM_W} />
            </RenderTexture>
          </meshBasicMaterial>
        </mesh>

        {/* Faint glass sheen in front of the view — sells "there is glass
            here" without obscuring the City. */}
        <mesh position={[0, 0, 0.04]} raycast={NO_RAYCAST}>
          <planeGeometry args={[win.width, win.height]} />
          <meshStandardMaterial
            color={GLASS_TINT}
            transparent
            opacity={0.06}
            roughness={0.05}
            metalness={0.1}
          />
        </mesh>

        {/* On-glass rain streaks (issue #44), just in front of the sheen. */}
        <RainStreakOverlay width={win.width} height={win.height} zOffset={0.05} />

        {/* Frame: four bars around the opening + a muntin cross. */}
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
    </group>
  );
}
