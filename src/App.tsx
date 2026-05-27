import { useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Spherical, Vector3 } from "three";
import { supabase } from "./lib/supabase";
import { supabaseCanvasRepository } from "./lib/supabase-canvas-repository";
import { bootstrapSessionAndRoom } from "./lib/bootstrap";
import { useAppStore } from "./store";
import { RoomScene } from "./components/RoomScene";
import { DebouncedSaver } from "./lib/debounced-saver";

const ROOM_BACKDROP = "#0e0b16";

// Orbit constraints (ADR-0009). Target sits at eye level near the Room's
// centre; the camera rotates around it. minPolarAngle / maxPolarAngle keep
// the camera between floor and ceiling. min/maxDistance keep it inside
// the Room without clipping walls.
const ORBIT_TARGET: [number, number, number] = [0, 1.5, 0];
const ORBIT_MIN_DISTANCE = 0.4;
const ORBIT_MAX_DISTANCE = 2.7;
const ORBIT_MIN_POLAR_ANGLE = 0.17; // ≈ 10° from straight up — stops at ceiling
const ORBIT_MAX_POLAR_ANGLE = Math.PI - 0.17; // ≈ 10° from straight down — stops at floor

// Per ADR-0005: debounce camera saves to ~1 s of quiet so we don't spam
// the API while the user is mid-rotate.
const CAMERA_SAVE_DEBOUNCE_MS = 1000;

type CameraPose = { yaw: number; pitch: number; distance: number };

/**
 * v2 entry point (ADR-0008). Bootstraps an anonymous session + Room +
 * Surfaces, then renders the Room interior. The camera is orbit-controlled
 * (ADR-0009) and its pose is debounce-persisted per Room.
 */
export function App() {
  const ready = useAppStore((s) => s.ready);
  const room = useAppStore((s) => s.currentRoom);
  const surfaces = useAppStore((s) => s.surfaces);
  const notes = useAppStore((s) => s.notes);
  const repo = useAppStore((s) => s.repo);
  const setSession = useAppStore((s) => s.setSession);
  const setRepo = useAppStore((s) => s.setRepo);
  const setRoom = useAppStore((s) => s.setRoom);

  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  // The camera-save channel. Recreated whenever the repo or current Room
  // changes so each Room saves to its own row.
  const cameraSaver = useMemo<DebouncedSaver<CameraPose> | null>(() => {
    if (!repo || !room) return null;
    return new DebouncedSaver(CAMERA_SAVE_DEBOUNCE_MS, async (pose) => {
      try {
        await repo.updateRoomCamera(room.id, pose);
      } catch (err) {
        console.warn("updateRoomCamera failed", err);
      }
    });
  }, [repo, room]);

  // Flush a pending save when the saver is replaced or unmounted so we
  // never lose a final camera pose.
  useEffect(() => {
    if (!cameraSaver) return;
    return () => {
      void cameraSaver.flush();
    };
  }, [cameraSaver]);

  useEffect(() => {
    let cancelled = false;
    bootstrapSessionAndRoom()
      .then(({ session, room, surfaces, notes }) => {
        if (cancelled) return;
        setSession(session);
        setRepo(supabaseCanvasRepository(supabase));
        setRoom(room, surfaces, notes);
      })
      .catch((err) => console.error("Bootstrap failed:", err));
    return () => {
      cancelled = true;
    };
  }, [setSession, setRepo, setRoom]);

  // Restore the persisted camera pose once the Room is loaded.
  useEffect(() => {
    if (!ready || !room || !orbitRef.current) return;
    const controls = orbitRef.current;
    const sph = new Spherical(
      room.camera_distance,
      room.camera_pitch,
      room.camera_yaw,
    );
    const offset = new Vector3().setFromSpherical(sph);
    const target = controls.target;
    controls.object.position.copy(target).add(offset);
    controls.update();
  }, [ready, room?.id, room?.camera_yaw, room?.camera_pitch, room?.camera_distance]);

  const onCameraChange = () => {
    const controls = orbitRef.current;
    if (!controls || !cameraSaver) return;
    const offset = new Vector3().subVectors(
      controls.object.position,
      controls.target,
    );
    const sph = new Spherical().setFromVector3(offset);
    cameraSaver.push({
      yaw: sph.theta,
      pitch: sph.phi,
      distance: sph.radius,
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: ROOM_BACKDROP }}>
      <Canvas
        shadows
        camera={{ position: [0, 1.6, 1.8], fov: 60, near: 0.05, far: 50 }}
      >
        <OrbitControls
          ref={orbitRef}
          target={ORBIT_TARGET}
          enableDamping
          dampingFactor={0.05}
          enablePan={false}
          minDistance={ORBIT_MIN_DISTANCE}
          maxDistance={ORBIT_MAX_DISTANCE}
          minPolarAngle={ORBIT_MIN_POLAR_ANGLE}
          maxPolarAngle={ORBIT_MAX_POLAR_ANGLE}
          rotateSpeed={0.7}
          zoomSpeed={0.8}
          onChange={onCameraChange}
        />
        {/* Warm sky / cooler floor — gives floor + ceiling distinct tones so
            corners read even with same-colour walls. */}
        <hemisphereLight args={["#ffe7c4", "#5a4a36", 0.55]} />
        {/* "Window" light from behind the camera shining onto wall_north +
            wall_west + floor. */}
        <directionalLight
          position={[1.8, 2.6, 2.2]}
          intensity={0.95}
          color="#fff1d6"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        {ready && room && (
          <RoomScene room={room} surfaces={surfaces} notes={notes} />
        )}
      </Canvas>
    </div>
  );
}
