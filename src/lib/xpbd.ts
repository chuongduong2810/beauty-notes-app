/**
 * XPBD (Extended Position-Based Dynamics) cloth solver for paper Notes
 * (issue #19, ADR-0012). This is the CPU prototype — the GPU port
 * (ping-pong fragment shader on float textures) is a follow-up.
 *
 * Positions are stored as flat Float32Arrays of `[x0, y0, z0, x1, y1, z1, ...]`
 * so they can later be uploaded straight to a GLSL texture or a
 * BufferGeometry without a copy.
 */

const GRAVITY_M_PER_S2 = 9.81;
/** XPBD constraint-solve iterations per `step`. Higher = stiffer. */
const CONSTRAINT_ITERATIONS = 8;
/**
 * Hard cap on the Verlet integration timestep. With Verlet, gravity
 * scales as `dt²` — a slow first frame (browser still loading,
 * tab-switch resume, etc.) can pass a huge `dt`, which teleports
 * unpinned particles far past their constraint distance and the
 * cloth explodes before constraints can recover. Clamping to ~60 fps
 * keeps the solver stable under stalls.
 */
const MAX_DT_S = 1 / 60;
/**
 * Velocity damping per step. Strong damping suppresses jiggle on what
 * should look like stiff paper. Implemented as `v *= (1 - DAMPING)`.
 */
const DAMPING = 0.04;
/**
 * If the largest per-particle position delta this step is below this
 * threshold, the step counts as "no motion". After `SLEEP_FRAMES` such
 * frames in a row, the solver flips to `sleeping = true` (#19: ~500 ms
 * at 60 fps).
 */
const MOTION_EPSILON_M = 1e-5;
const SLEEP_FRAMES = 30;

export type ClothParams = {
  /** Width and height in metres of the rest-state cloth. */
  width: number;
  height: number;
  /** Subdivisions along each side. Particle count = (segments + 1)². */
  segments: number;
  /** Particle indices whose positions stay fixed. */
  pins: readonly number[];
};

/** Distance constraint between two particles, with a target rest length. */
export type Edge = {
  i: number;
  j: number;
  restLength: number;
};

export type ClothState = {
  positions: Float32Array;
  prevPositions: Float32Array;
  pinned: boolean[];
  particleCount: number;
  edges: Edge[];
  /** True while the solver is asleep — `step` is a no-op (#19). */
  sleeping: boolean;
  /** Frames in a row with no motion. Resets to 0 on any motion. */
  idleFrames: number;
};

export function createCloth(params: ClothParams): ClothState {
  const verticesPerSide = params.segments + 1;
  const particleCount = verticesPerSide * verticesPerSide;
  const positions = new Float32Array(particleCount * 3);
  const dx = params.width / params.segments;
  const dy = params.height / params.segments;

  for (let j = 0; j < verticesPerSide; j++) {
    for (let i = 0; i < verticesPerSide; i++) {
      const idx = (j * verticesPerSide + i) * 3;
      positions[idx] = -params.width / 2 + i * dx;
      positions[idx + 1] = -params.height / 2 + j * dy;
      positions[idx + 2] = 0;
    }
  }

  const prevPositions = new Float32Array(positions);
  const pinned = new Array<boolean>(particleCount).fill(false);
  for (const i of params.pins) pinned[i] = true;

  // Constraint topology:
  // - Structural: horizontal + vertical neighbours (length = dx / dy).
  //   Resists stretch along the cloth grid.
  // - Shear: both diagonals of every cell (length = √(dx² + dy²)).
  //   Resists scissoring — without these the cloth behaves like a
  //   fishnet and a 4-corner-pinned paper sags into a teardrop.
  // Bending constraints (every-other vertex) are a follow-up for the
  // single-pin / push-pin case where heavy sag would otherwise look
  // like cloth, not paper.
  const edges: Edge[] = [];
  const pushEdge = (a: number, b: number) => {
    const oa = a * 3;
    const ob = b * 3;
    const dx = positions[ob] - positions[oa];
    const dy = positions[ob + 1] - positions[oa + 1];
    const dz = positions[ob + 2] - positions[oa + 2];
    edges.push({ i: a, j: b, restLength: Math.hypot(dx, dy, dz) });
  };
  // Structural.
  for (let j = 0; j < verticesPerSide; j++) {
    for (let i = 0; i < verticesPerSide; i++) {
      const me = j * verticesPerSide + i;
      if (i + 1 < verticesPerSide) pushEdge(me, j * verticesPerSide + (i + 1));
      if (j + 1 < verticesPerSide) pushEdge(me, (j + 1) * verticesPerSide + i);
    }
  }
  // Shear — both diagonals per cell.
  for (let j = 0; j < params.segments; j++) {
    for (let i = 0; i < params.segments; i++) {
      const a = j * verticesPerSide + i;        // BL
      const b = a + 1;                          // BR
      const c = a + verticesPerSide;            // TL
      const d = c + 1;                          // TR
      pushEdge(a, d); // BL → TR
      pushEdge(b, c); // BR → TL
    }
  }

  return {
    positions,
    prevPositions,
    pinned,
    particleCount,
    edges,
    sleeping: false,
    idleFrames: 0,
  };
}

/**
 * Wake a sleeping cloth — called when an external event (drag, layout
 * change) reintroduces motion that the solver should respond to. Does
 * nothing if the cloth is already awake.
 */
export function wake(cloth: ClothState): void {
  cloth.sleeping = false;
  cloth.idleFrames = 0;
}

export function step(cloth: ClothState, dt: number): void {
  if (cloth.sleeping) return;

  // Cap dt so Verlet's dt² term can't teleport particles on slow frames.
  if (dt > MAX_DT_S) dt = MAX_DT_S;

  const { positions, prevPositions, pinned, particleCount, edges } = cloth;
  const ay = -GRAVITY_M_PER_S2;
  let maxDelta = 0;

  // Verlet integration with velocity damping: x' = x + (1 - DAMPING)·(x - x_prev)
  // + a · dt². Pinned particles skip the integration entirely so their
  // position never changes.
  for (let i = 0; i < particleCount; i++) {
    if (pinned[i]) continue;
    const o = i * 3;
    const x = positions[o];
    const y = positions[o + 1];
    const z = positions[o + 2];
    const vx = (x - prevPositions[o]) * (1 - DAMPING);
    const vy = (y - prevPositions[o + 1]) * (1 - DAMPING);
    const vz = (z - prevPositions[o + 2]) * (1 - DAMPING);

    prevPositions[o] = x;
    prevPositions[o + 1] = y;
    prevPositions[o + 2] = z;

    const nx = x + vx;
    const ny = y + vy + ay * dt * dt;
    const nz = z + vz;
    positions[o] = nx;
    positions[o + 1] = ny;
    positions[o + 2] = nz;

    const dpx = nx - x;
    const dpy = ny - y;
    const dpz = nz - z;
    const d = Math.hypot(dpx, dpy, dpz);
    if (d > maxDelta) maxDelta = d;
  }

  // PBD constraint projection — Gauss-Seidel sweep over the edge list,
  // multiple iterations. Both endpoints get half the correction unless
  // one is pinned (then the other absorbs the full correction).
  for (let iter = 0; iter < CONSTRAINT_ITERATIONS; iter++) {
    for (const e of edges) {
      const oi = e.i * 3;
      const oj = e.j * 3;
      const dx = positions[oj] - positions[oi];
      const dy = positions[oj + 1] - positions[oi + 1];
      const dz = positions[oj + 2] - positions[oi + 2];
      const currLen = Math.hypot(dx, dy, dz);
      if (currLen < 1e-9) continue;
      const diff = (currLen - e.restLength) / currLen;
      const pi = pinned[e.i];
      const pj = pinned[e.j];
      if (pi && pj) continue;
      // Weight: pinned endpoints contribute 0, the other absorbs 1.
      // For two free endpoints, split the correction in half.
      const wi = pi ? 0 : pj ? 1 : 0.5;
      const wj = pj ? 0 : pi ? 1 : 0.5;
      positions[oi] += dx * diff * wi;
      positions[oi + 1] += dy * diff * wi;
      positions[oi + 2] += dz * diff * wi;
      positions[oj] -= dx * diff * wj;
      positions[oj + 1] -= dy * diff * wj;
      positions[oj + 2] -= dz * diff * wj;
    }
  }

  // Sleep bookkeeping: a frame whose largest pre-constraint motion is
  // under MOTION_EPSILON_M counts as idle. SLEEP_FRAMES idle frames in
  // a row flips the solver to sleeping.
  if (maxDelta < MOTION_EPSILON_M) {
    cloth.idleFrames += 1;
    if (cloth.idleFrames >= SLEEP_FRAMES) cloth.sleeping = true;
  } else {
    cloth.idleFrames = 0;
  }
}
