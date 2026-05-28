import { DoubleSide } from "three";

/**
 * A small set of room-dressing objects to make the Room read as a
 * lived-in space rather than an empty box. Built from primitive
 * geometries only (no GLTF imports, no heavy textures) so the perf
 * footprint stays small:
 *
 *  - Floor lamp in the back-left corner with a warm point light
 *  - Wooden desk against the north wall
 *  - Potted plant in the back-right corner
 *
 * Positions assume the default Room (6 × 6 × 3 m). If Rooms become
 * resizable later, these will need to scale with `room.width_m / depth_m`.
 */

const WOOD = "#8b6f47";
const WOOD_DARK = "#6e5836";
const METAL = "#2a2a2a";
const SHADE = "#fbe8c4";
const POT = "#b87f5e";
const LEAF_A = "#3a5f3a";
const LEAF_B = "#4a6f4a";
const LEAF_C = "#2a4f2a";

export function RoomFurniture() {
  return (
    <group>
      {/* Floor lamp — back-left corner (north-west). */}
      <group position={[-2.4, 0, -2.4]}>
        <mesh castShadow receiveShadow position={[0, 0.025, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.05, 24]} />
          <meshStandardMaterial color={METAL} roughness={0.5} metalness={0.6} />
        </mesh>
        <mesh castShadow position={[0, 0.85, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 1.6, 12]} />
          <meshStandardMaterial color={METAL} roughness={0.5} metalness={0.6} />
        </mesh>
        <mesh castShadow position={[0, 1.7, 0]}>
          <coneGeometry args={[0.2, 0.32, 24, 1, true]} />
          <meshStandardMaterial
            color={SHADE}
            roughness={0.7}
            metalness={0}
            side={DoubleSide}
            emissive={SHADE}
            emissiveIntensity={0.15}
          />
        </mesh>
        {/* Warm bulb light. No shadow-casting — keeps GPU cost flat
            and the directional key light is already doing shadows. */}
        <pointLight
          position={[0, 1.6, 0]}
          intensity={0.6}
          color="#ffd9a0"
          distance={3.5}
          decay={1.6}
        />
      </group>

      {/* Desk — centred against the north wall. */}
      <group position={[0, 0, -2.5]}>
        {/* Top */}
        <mesh castShadow receiveShadow position={[0, 0.75, 0.3]}>
          <boxGeometry args={[1.6, 0.04, 0.6]} />
          <meshStandardMaterial color={WOOD} roughness={0.8} metalness={0} />
        </mesh>
        {/* Apron — thin skirt under the top for visual weight */}
        <mesh castShadow receiveShadow position={[0, 0.715, 0.05]}>
          <boxGeometry args={[1.5, 0.04, 0.04]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.85} />
        </mesh>
        {/* Four legs */}
        {[
          [-0.75, 0.06] as const,
          [0.75, 0.06] as const,
          [-0.75, 0.55] as const,
          [0.75, 0.55] as const,
        ].map(([x, z]) => (
          <mesh
            key={`${x},${z}`}
            castShadow
            receiveShadow
            position={[x, 0.37, z]}
          >
            <boxGeometry args={[0.04, 0.74, 0.04]} />
            <meshStandardMaterial color={WOOD_DARK} roughness={0.85} />
          </mesh>
        ))}
      </group>

      {/* Potted plant — back-right corner (north-east). */}
      <group position={[2.4, 0, -2.4]}>
        <mesh castShadow receiveShadow position={[0, 0.13, 0]}>
          <cylinderGeometry args={[0.16, 0.12, 0.26, 24]} />
          <meshStandardMaterial color={POT} roughness={0.85} metalness={0} />
        </mesh>
        <mesh castShadow position={[0, 0.42, 0]}>
          <sphereGeometry args={[0.2, 16, 12]} />
          <meshStandardMaterial color={LEAF_A} roughness={0.9} metalness={0} />
        </mesh>
        <mesh castShadow position={[0.1, 0.52, 0.06]}>
          <sphereGeometry args={[0.14, 16, 12]} />
          <meshStandardMaterial color={LEAF_B} roughness={0.9} metalness={0} />
        </mesh>
        <mesh castShadow position={[-0.09, 0.5, -0.05]}>
          <sphereGeometry args={[0.13, 16, 12]} />
          <meshStandardMaterial color={LEAF_C} roughness={0.9} metalness={0} />
        </mesh>
      </group>
    </group>
  );
}
