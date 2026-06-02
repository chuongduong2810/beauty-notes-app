import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  MeshBasicMaterial,
  SRGBColorSpace,
} from "three";
import { BatchedRenderer, ParticleSystem, RenderMode } from "three.quarks";
import {
  Bezier,
  ColorOverLife,
  ConstantColor,
  ConstantValue,
  type EmitterShape,
  Gradient,
  IntervalValue,
  type Particle,
  PiecewiseBezier,
  SizeOverLife,
  Vector3 as QVector3,
  Vector4 as QVector4,
} from "quarks.core";
import { RAIN_BOUNDS, type RainBounds } from "../lib/rain-field";

/**
 * Falling rain in the City, the falling-rain layer of the **Weather**
 * (issue #43, ADR-0015). Previously a hand-rolled `lineSegments` curtain that
 * fell dead-straight at one fixed streak length; issue #127 / ADR-0024 replace
 * that renderer with the **three.quarks** GPU particle engine so the downpour
 * reads as a lively, depth-rich rain — wind drift, varied drop size/length,
 * near drops faster and larger than far ones.
 *
 * MUST be mounted INSIDE the City `RenderTexture` sub-scene in `CityView`
 * so it shares that sub-scene's camera, lights and fog and paints into the
 * glass texture (not the main Room scene). The rain volume still comes from
 * the pure, tested `RAIN_BOUNDS(roomWidthM)` slab in `rain-field.ts`, which
 * sits wholly beyond the west wall (x < -width/2) — so the rain reads through
 * the Window but never enters the Room interior (the ADR-0015 containment
 * invariant, kept test-covered).
 *
 * Per ADR-0024 frame-for-frame **determinism is relaxed for this layer only**:
 * three.quarks owns its own RNG, so there is no seeded field here. (The
 * separate on-glass rain streaks — `rain-streaks.ts` / `RainStreakOverlay` —
 * stay deterministic and are untouched.) `rain-field.ts` now owns only the
 * rain VOLUME; the particle engine owns all motion.
 *
 * Weather is fixed and always-on: no props beyond the Room width, no controls.
 */

/** Particle population — kept to a few thousand so the engine stays inside the
 *  Bloom/DOF/SSAO budget the rest of the City sub-scene already spends. */
const DROP_COUNT = 2600;

/** Drop tint — a cool, dim grey-blue that catches the dusk sky light
 *  (~`#c4cee0`), as 0..1 RGB written into each drop's start colour. */
const RAIN_RGB = { r: 0xc4 / 255, g: 0xce / 255, b: 0xe0 / 255 };

/** Steady horizontal wind drift (m/s). Gives the rain a slanted fall rather
 *  than a dead-straight curtain. +Z drifts along the skyline; a small -X nudge
 *  pushes drops gently toward the wall plane as they fall. */
const WIND_Z = 2.4;
const WIND_X = -0.6;

/** Vertical fall-speed range (m/s) across the slab's far→near edges. Viewed
 *  across the City the apparent motion reads much slower than the raw m/s, so
 *  these run faster than real drizzle to feel like real rainfall. Near drops
 *  (front edge) fall faster; far drops slower — a depth cue. */
const NEAR_FALL_SPEED = 30;
const FAR_FALL_SPEED = 17;

/** Per-drop sprite size range (world metres, before velocity-stretch). Near
 *  drops larger, far drops smaller — reinforces depth. */
const NEAR_SIZE_M = 0.22;
const FAR_SIZE_M = 0.1;

/** Soft-dot sprite texture resolution. Small: it is only ever stretched into a
 *  thin streak, so it needs no detail. */
const SPRITE_TEX_SIZE = 64;

/** Velocity-stretch factor for `StretchedBillBoard`: how far each sprite is
 *  smeared along its velocity. Tuned so fast near drops draw long streaks. */
const STRETCH_SPEED_FACTOR = 0.06;

/**
 * Build the small procedural soft-dot sprite texture (mirrors the canvas
 * approach in `CityView.tsx`'s `createRainStreakTexture`). A white radial
 * gradient on transparent; stretched by velocity in `StretchedBillBoard` mode
 * it reads as a motion-blurred rain streak. The drop's grey-blue tint comes
 * from the particle colour, so the texture itself stays neutral white.
 *
 * Returns `null` in non-DOM environments (vitest, SSR), matching the
 * codebase's nullable-texture convention.
 */
function createRainSpriteTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_TEX_SIZE;
  canvas.height = SPRITE_TEX_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const c = SPRITE_TEX_SIZE / 2;
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.5, "rgba(255, 255, 255, 0.55)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SPRITE_TEX_SIZE, SPRITE_TEX_SIZE);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Build the base sprite material for the rain. three.quarks rebuilds its own
 * stretched-billboard `ShaderMaterial` from this, but reads `map`, `blending`,
 * `transparent` and the depth flags off it: additive over the dusk sky so
 * drops glint without darkening the City, and no depth-write so they never
 * punch holes in each other or the skyline (matching the old material).
 */
function createRainMaterial(tex: CanvasTexture | null): MeshBasicMaterial {
  return new MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

/** Map a [0, 1) sample to [min, max]. */
function lerp(t: number, min: number, max: number): number {
  return min + t * (max - min);
}

/**
 * A three.quarks `EmitterShape` that scatters drops uniformly through the
 * {@link RAIN_BOUNDS} slab and gives each one a downward velocity with a
 * steady horizontal wind drift. Depth (X within the slab) drives the variation
 * issue #127 asks for: near drops (front edge, larger X) fall faster, spawn
 * larger and brighter; far drops fall slower, spawn smaller and dimmer.
 *
 * The system runs in `worldSpace` with its emitter at the origin, so the
 * positions and velocities written here are world-space directly — exactly the
 * `RAIN_BOUNDS` frame (Three.js world metres). We set velocity ourselves and
 * leave the system's `startSpeed` at 0, so the engine integrates
 * `position += velocity * dt` straight from these values.
 */
class RainSlabEmitter implements EmitterShape {
  type = "rain-slab";

  constructor(private readonly bounds: RainBounds) {}

  initialize(p: Particle): void {
    const b = this.bounds;
    // Uniform scatter through the slab. three.quarks owns the RNG here
    // (determinism relaxed per ADR-0024), so plain Math.random is fine.
    const x = lerp(Math.random(), b.minX, b.maxX);
    const y = lerp(Math.random(), b.minY, b.maxY);
    const z = lerp(Math.random(), b.minZ, b.maxZ);
    p.position.set(x, y, z);

    // Depth factor: 0 at the far edge (minX), 1 at the near edge (maxX).
    const depth = (x - b.minX) / (b.maxX - b.minX);
    const fall = lerp(depth, FAR_FALL_SPEED, NEAR_FALL_SPEED);
    // A little per-drop jitter so columns don't fall in lockstep.
    const jitter = lerp(Math.random(), 0.85, 1.15);
    p.velocity.set(WIND_X, -fall * jitter, WIND_Z);

    // Size tracks depth (near larger, far smaller). The square sprite is
    // stretched along velocity into the visible streak.
    const size = lerp(depth, FAR_SIZE_M, NEAR_SIZE_M);
    p.startSize.set(size, size, size);
    p.size.copy(p.startSize);

    // Far drops dimmer than near (depth fade): scale start alpha by depth.
    const alpha = lerp(depth, 0.35, 0.85);
    p.startColor.set(RAIN_RGB.r, RAIN_RGB.g, RAIN_RGB.b, alpha);
    p.color.copy(p.startColor);
  }

  toJSON() {
    return { type: this.type };
  }

  // Stateless: all per-drop variation is set in initialize().
  update(): void {}

  clone(): EmitterShape {
    return new RainSlabEmitter(this.bounds);
  }
}

export function CityRain({ roomWidthM }: { roomWidthM: number }) {
  const bounds = useMemo(() => RAIN_BOUNDS(roomWidthM), [roomWidthM]);

  // Build the engine once. `batchedRenderer` is the Object3D drawn into the
  // R3F tree; `system` owns emission + the per-drop lifecycle. The system's
  // own `emitter` (also an Object3D) is added to the tree so it lives in the
  // scene graph at the origin (identity world matrix → world-space slab).
  const { batchedRenderer, system, texture } = useMemo(() => {
    const tex = createRainSpriteTexture();
    const batched = new BatchedRenderer();

    // Drops must survive the full slab fall. Life = slab height / slowest fall,
    // with headroom, so even far (slow) drops cross the whole volume before
    // they die and the engine recycles their budget into a fresh spawn.
    const slabHeight = bounds.maxY - bounds.minY;
    const maxLife = (slabHeight / FAR_FALL_SPEED) * 1.1;

    const ps = new ParticleSystem({
      duration: 1,
      looping: true,
      worldSpace: true,
      // Steady stream sustaining ~DROP_COUNT live drops given maxLife.
      emissionOverTime: new ConstantValue(DROP_COUNT / maxLife),
      // Velocity is set directly in the emitter shape, so no extra startSpeed.
      startSpeed: new ConstantValue(0),
      startLife: new IntervalValue(maxLife * 0.85, maxLife),
      // startSize / startColor are overwritten per-drop in the emitter shape,
      // but the system requires generators here; give it sensible defaults.
      startSize: new IntervalValue(FAR_SIZE_M, NEAR_SIZE_M),
      startColor: new ConstantColor(
        new QVector4(RAIN_RGB.r, RAIN_RGB.g, RAIN_RGB.b, 0.7),
      ),
      shape: new RainSlabEmitter(bounds),
      material: createRainMaterial(tex),
      renderMode: RenderMode.StretchedBillBoard,
      // Stretch each sprite along its velocity → a motion-blur streak.
      rendererEmitterSettings: {
        speedFactor: STRETCH_SPEED_FACTOR,
        lengthFactor: 0,
      },
      renderOrder: 2,
    });

    // Fade each drop in at birth and out near death so streaks don't pop.
    // Gradient colour stays white (the per-drop tint lives in startColor, which
    // ColorOverLife multiplies in); only the alpha ramp does the fade.
    ps.addBehavior(
      new ColorOverLife(
        new Gradient(
          [
            [new QVector3(1, 1, 1), 0],
            [new QVector3(1, 1, 1), 1],
          ],
          [
            [0, 0],
            [1, 0.12],
            [1, 0.88],
            [0, 1],
          ],
        ),
      ),
    );
    // Gentle size taper over life keeps the head crisp, the tail soft.
    ps.addBehavior(
      new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 1, 0.9, 0.85), 0]])),
    );

    batched.addSystem(ps);

    return { batchedRenderer: batched, system: ps, texture: tex };
  }, [bounds]);

  const prewarmed = useRef(false);

  useFrame((_, delta) => {
    // Clamp dt so a tab-resume / breakpoint can't teleport the whole sim,
    // exactly as the old hand-rolled stepper did.
    const dt = Math.min(delta, 0.05);
    if (!prewarmed.current) {
      // Prewarm so the window isn't empty on the first visible frame: run the
      // sim forward by ~one full drop lifetime in fixed steps before drawing.
      const slabHeight = bounds.maxY - bounds.minY;
      const warm = (slabHeight / FAR_FALL_SPEED) * 1.1;
      for (let t = 0; t < warm; t += 0.05) batchedRenderer.update(0.05);
      prewarmed.current = true;
    }
    batchedRenderer.update(dt);
  });

  // Dispose the engine + texture when the component unmounts / bounds change.
  useEffect(() => {
    return () => {
      system.dispose();
      texture?.dispose();
    };
  }, [system, texture]);

  return (
    <>
      <primitive object={batchedRenderer} />
      <primitive object={system.emitter} />
    </>
  );
}
