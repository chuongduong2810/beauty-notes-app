import { useMemo } from "react";
import { RenderTexture, PerspectiveCamera } from "@react-three/drei";
import {
  DEFAULT_ROOM_WIDTH_M,
  DEFAULT_ROOM_DEPTH_M,
  DEFAULT_ROOM_HEIGHT_M,
} from "../lib/room";
import { buildingLayout, windowPlacement } from "../lib/city-layout";
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
