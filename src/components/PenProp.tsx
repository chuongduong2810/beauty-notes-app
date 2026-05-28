import type { ThreeEvent } from "@react-three/fiber";
import type { ReactNode } from "react";
import { Mesh as ThreeMesh } from "three";

/**
 * Three.js's default Mesh.prototype.raycast. We pass this explicitly
 * instead of `undefined` when raycast is enabled — R3F's applyProps
 * assigns whatever value you give it, and assigning `undefined`
 * creates an own property on the instance that shadows the prototype
 * method. The next raycast then calls `instance.raycast()` on
 * undefined and throws "raycast is not a function". This constant
 * lets us toggle the prop between "enabled" and "noop" without ever
 * passing undefined.
 */
const DEFAULT_MESH_RAYCAST = ThreeMesh.prototype.raycast;
const NO_RAYCAST = () => null;

/**
 * A simple 3D pen primitive — three stacked cylinder/cone meshes that
 * together read as a pen at the Room's scale (about 14 cm long).
 *
 * Built local-axis-aligned along +Y so callers can place + rotate the
 * whole group with familiar Three.js conventions. The tip is at the
 * group's origin so a caller positioning the pen "at the cursor on the
 * wall" can just translate the origin to the wall hit and rotate so
 * the +Y axis points away from the wall.
 *
 * Used twice in the scene:
 *  - Resting on the desk (issue #35 follow-up): the user clicks to
 *    pick up the pen and enter Pen mode.
 *  - Hovering at the cursor while a Stroke is being drawn: the pen
 *    visually substitutes for the system cursor on the wall.
 *
 * The component renders inert geometry — the caller is responsible
 * for click handling. Pass `onPointerDown` (or any pointer prop) to
 * make the prop pickable.
 */
const PEN_BODY_LENGTH_M = 0.12; // ~12 cm
const PEN_TIP_LENGTH_M = 0.012;
const PEN_CAP_LENGTH_M = 0.018;
const PEN_BODY_RADIUS_M = 0.005;
const PEN_TIP_RADIUS_M = 0.0018;

const PEN_BODY_COLOR = "#2c2030";
const PEN_TIP_COLOR = "#cfa15a";
const PEN_CAP_COLOR = "#0e0a14";
const PEN_CAP_ACCENT = "#cfa15a";

export function PenProp({
  onPointerDown,
  onClick,
  raycastEnabled = true,
  children,
}: {
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  /** When false, the pen geometry is invisible to the raycaster.
   *  Useful when the pen renders as a cursor follower and shouldn't
   *  intercept pen-strokes on the wall behind it. */
  raycastEnabled?: boolean;
  /** Optional child group — handy for callers that want to attach a
   *  hover halo or a "pick me up" hint without cluttering this file. */
  children?: ReactNode;
}) {
  const raycast = raycastEnabled ? DEFAULT_MESH_RAYCAST : NO_RAYCAST;
  return (
    <group>
      {/* Tip at origin (group y=0), narrow cone pointing -Y so the
          pen's body extends along +Y. */}
      <mesh
        castShadow
        position={[0, PEN_TIP_LENGTH_M / 2, 0]}
        onPointerDown={onPointerDown}
        onClick={onClick}
        raycast={raycast}
      >
        <coneGeometry args={[PEN_TIP_RADIUS_M, PEN_TIP_LENGTH_M, 12]} />
        <meshStandardMaterial
          color={PEN_TIP_COLOR}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>
      {/* Main barrel. */}
      <mesh
        castShadow
        position={[0, PEN_TIP_LENGTH_M + PEN_BODY_LENGTH_M / 2, 0]}
        onPointerDown={onPointerDown}
        onClick={onClick}
        raycast={raycast}
      >
        <cylinderGeometry
          args={[PEN_BODY_RADIUS_M, PEN_BODY_RADIUS_M, PEN_BODY_LENGTH_M, 16]}
        />
        <meshStandardMaterial
          color={PEN_BODY_COLOR}
          roughness={0.45}
          metalness={0.15}
        />
      </mesh>
      {/* End cap with a thin metallic ring at the seam — sells the
          "pen" silhouette at a glance even from across the Room. */}
      <mesh
        castShadow
        position={[
          0,
          PEN_TIP_LENGTH_M + PEN_BODY_LENGTH_M + PEN_CAP_LENGTH_M / 2,
          0,
        ]}
        onPointerDown={onPointerDown}
        onClick={onClick}
        raycast={raycast}
      >
        <cylinderGeometry
          args={[
            PEN_BODY_RADIUS_M * 1.05,
            PEN_BODY_RADIUS_M * 1.05,
            PEN_CAP_LENGTH_M,
            16,
          ]}
        />
        <meshStandardMaterial
          color={PEN_CAP_COLOR}
          roughness={0.55}
          metalness={0.1}
        />
      </mesh>
      <mesh
        castShadow
        position={[0, PEN_TIP_LENGTH_M + PEN_BODY_LENGTH_M, 0]}
        raycast={raycast}
      >
        <cylinderGeometry
          args={[
            PEN_BODY_RADIUS_M * 1.1,
            PEN_BODY_RADIUS_M * 1.1,
            0.002,
            16,
          ]}
        />
        <meshStandardMaterial
          color={PEN_CAP_ACCENT}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      {children}
    </group>
  );
}
