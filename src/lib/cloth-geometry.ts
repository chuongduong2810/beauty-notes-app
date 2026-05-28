import { BufferAttribute, BufferGeometry } from "three";
import { createCloth, type ClothParams, type ClothState } from "./xpbd";

/**
 * Builds a Three.js `BufferGeometry` whose `position` attribute SHARES
 * memory with the cloth solver's `positions` Float32Array. Stepping the
 * solver mutates the geometry directly — set `position.needsUpdate = true`
 * each frame after `step()` and the GPU sees the new positions.
 *
 * The geometry's vertex order is bottom-left → top-right, row-major,
 * matching `createCloth`'s layout in xpbd.ts.
 */
export function createClothGeometry(params: ClothParams): {
  cloth: ClothState;
  geometry: BufferGeometry;
} {
  const cloth = createCloth(params);
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(cloth.positions, 3),
  );

  // Triangulate the grid. Two triangles per cell: (a, c, b) + (b, c, d)
  // where a, b are bottom edge and c, d are top edge.
  const verticesPerSide = params.segments + 1;
  const indices: number[] = [];
  for (let j = 0; j < params.segments; j++) {
    for (let i = 0; i < params.segments; i++) {
      const a = j * verticesPerSide + i;
      const b = a + 1;
      const c = a + verticesPerSide;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return { cloth, geometry };
}

/**
 * Indices of the four corner particles in a square cloth — pin these
 * for the "flat, taut paper" default behaviour from issue #19.
 */
export function cornerPins(segments: number): number[] {
  const last = segments;
  const verticesPerSide = segments + 1;
  return [
    0,
    last,
    last * verticesPerSide,
    last * verticesPerSide + last,
  ];
}
