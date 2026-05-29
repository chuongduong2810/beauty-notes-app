import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Float32BufferAttribute, type Points } from "three";
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
const RAIN_COLOR = "#aab6cc";

export function CityRain({ roomWidthM }: { roomWidthM: number }) {
  const bounds = useMemo(() => RAIN_BOUNDS(roomWidthM), [roomWidthM]);

  // Build the initial field + its GPU geometry once. `positions` is the
  // live buffer we mutate each frame; `speeds` stays constant per drop.
  const { geometry, positions, speeds, count } = useMemo(() => {
    const field = createRainField(DROP_COUNT, bounds, RAIN_SEED);
    const geom = new BufferGeometry();
    geom.setAttribute(
      "position",
      new Float32BufferAttribute(field.positions, 3),
    );
    return {
      geometry: geom,
      positions: field.positions,
      speeds: field.speeds,
      count: field.count,
    };
  }, [bounds]);

  const pointsRef = useRef<Points>(null);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    // Clamp dt so a tab-resume / breakpoint can't teleport every drop.
    const dt = Math.min(delta, 0.05);
    elapsed.current += dt;
    for (let i = 0; i < count; i++) {
      const j = i * 3;
      const next = stepRaindrop(
        positions[j],
        positions[j + 1],
        positions[j + 2],
        speeds[i],
        dt,
        bounds,
      );
      positions[j] = next.x;
      positions[j + 1] = next.y;
      positions[j + 2] = next.z;
    }
    geometry.attributes.position.needsUpdate = true;

    // Subtle, continuous breathing of intensity — pure life, no controls.
    const mat = pointsRef.current?.material;
    if (mat && !Array.isArray(mat) && "opacity" in mat) {
      mat.opacity = 0.5 + 0.12 * Math.sin(elapsed.current * 1.3);
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color={RAIN_COLOR}
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </points>
  );
}
