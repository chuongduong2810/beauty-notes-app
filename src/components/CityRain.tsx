import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Float32BufferAttribute,
  type LineSegments,
} from "three";
import {
  createRainField,
  stepRaindrop,
  RAIN_BOUNDS,
} from "../lib/rain-field";

/**
 * Falling rain in the City, the falling-rain layer of the **Weather**
 * (issue #43, ADR-0015). Rendered as a cheap `Points` cloud confined to a
 * slab of world space that sits wholly beyond the west wall — so the rain
 * reads through the Window but never enters the Room interior.
 *
 * MUST be mounted INSIDE the City `RenderTexture` sub-scene in `CityView`
 * so it shares that sub-scene's camera, lights and fog and paints into the
 * glass texture (not the main Room scene). The maths lives in the pure,
 * tested `rain-field.ts`; this component only owns the GPU buffer and the
 * per-frame fall + recycle, driven by `useFrame`.
 *
 * Weather is fixed and always-on: no props, no user controls. A gentle
 * sine on opacity gives the downpour life without any configurable state.
 */

/** Particle count — capped to stay inside the Bloom/DOF/SSAO + cloth
 *  budget (issue #43 asks for a few thousand). */
const DROP_COUNT = 2200;

/** Stable seed so the rain field is identical across renders / reloads. */
const RAIN_SEED = 0x7a1f04;

/** Drop tint — a cool, dim grey-blue that catches the dusk sky light. */
const RAIN_COLOR = "#c4cee0";

/** Vertical length of each drop's motion-blur streak (metres). Drops read as
 *  short falling lines, not floating dots — far more legible as rain. */
const STREAK_LEN_M = 0.9;

export function CityRain({ roomWidthM }: { roomWidthM: number }) {
  const bounds = useMemo(() => RAIN_BOUNDS(roomWidthM), [roomWidthM]);

  // Build the initial field once. `heads` is the live drop-position buffer we
  // step each frame; `verts` is the GPU line buffer (2 vertices per drop: the
  // falling head at the bottom and a tail STREAK_LEN_M above it). `speeds`
  // stays constant per drop.
  const { geometry, heads, verts, speeds, count } = useMemo(() => {
    const field = createRainField(DROP_COUNT, bounds, RAIN_SEED);
    const lineVerts = new Float32Array(field.count * 6);
    for (let i = 0; i < field.count; i++) {
      const x = field.positions[i * 3];
      const y = field.positions[i * 3 + 1];
      const z = field.positions[i * 3 + 2];
      const k = i * 6;
      lineVerts[k] = x; // head (bottom)
      lineVerts[k + 1] = y;
      lineVerts[k + 2] = z;
      lineVerts[k + 3] = x; // tail (top), trailing the fall
      lineVerts[k + 4] = y + STREAK_LEN_M;
      lineVerts[k + 5] = z;
    }
    const geom = new BufferGeometry();
    geom.setAttribute("position", new Float32BufferAttribute(lineVerts, 3));
    return {
      geometry: geom,
      heads: field.positions,
      verts: lineVerts,
      speeds: field.speeds,
      count: field.count,
    };
  }, [bounds]);

  const linesRef = useRef<LineSegments>(null);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    // Clamp dt so a tab-resume / breakpoint can't teleport every drop.
    const dt = Math.min(delta, 0.05);
    elapsed.current += dt;
    for (let i = 0; i < count; i++) {
      const j = i * 3;
      const next = stepRaindrop(
        heads[j],
        heads[j + 1],
        heads[j + 2],
        speeds[i],
        dt,
        bounds,
      );
      heads[j] = next.x;
      heads[j + 1] = next.y;
      heads[j + 2] = next.z;
      const k = i * 6;
      verts[k] = next.x;
      verts[k + 1] = next.y;
      verts[k + 2] = next.z;
      verts[k + 3] = next.x;
      verts[k + 4] = next.y + STREAK_LEN_M;
      verts[k + 5] = next.z;
    }
    geometry.attributes.position.needsUpdate = true;

    // Subtle, continuous breathing of intensity — pure life, no controls.
    const mat = linesRef.current?.material;
    if (mat && !Array.isArray(mat) && "opacity" in mat) {
      mat.opacity = 0.55 + 0.1 * Math.sin(elapsed.current * 1.3);
    }
  });

  return (
    <lineSegments ref={linesRef} geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial
        color={RAIN_COLOR}
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </lineSegments>
  );
}
