import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { supabase } from "./lib/supabase";
import { supabaseCanvasRepository } from "./lib/supabase-canvas-repository";
import { bootstrapSessionAndRoom } from "./lib/bootstrap";
import { useAppStore } from "./store";
import { RoomScene } from "./components/RoomScene";

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

/**
 * v2 entry point (ADR-0008). Bootstraps an anonymous session + Room +
 * Surfaces, then renders the Room interior. The camera is orbit-controlled
 * (ADR-0009) so the user can rotate, zoom, and inspect the Room from any
 * angle. No Notes yet (issue #15), no Focus mode yet (issue #17).
 */
export function App() {
  const ready = useAppStore((s) => s.ready);
  const room = useAppStore((s) => s.currentRoom);
  const surfaces = useAppStore((s) => s.surfaces);
  const setSession = useAppStore((s) => s.setSession);
  const setRepo = useAppStore((s) => s.setRepo);
  const setRoom = useAppStore((s) => s.setRoom);

  useEffect(() => {
    let cancelled = false;
    bootstrapSessionAndRoom()
      .then(({ session, room, surfaces }) => {
        if (cancelled) return;
        setSession(session);
        setRepo(supabaseCanvasRepository(supabase));
        setRoom(room, surfaces);
      })
      .catch((err) => console.error("Bootstrap failed:", err));
    return () => {
      cancelled = true;
    };
  }, [setSession, setRepo, setRoom]);

  return (
    <div style={{ position: "fixed", inset: 0, background: ROOM_BACKDROP }}>
      <Canvas
        shadows
        camera={{ position: [0, 1.6, 1.8], fov: 60, near: 0.05, far: 50 }}
      >
        <OrbitControls
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
        />
        {/* Warm sky / cooler floor — gives floor + ceiling distinct tones so
            corners read even with same-colour walls. */}
        <hemisphereLight
          args={["#ffe7c4", "#5a4a36", 0.55]}
        />
        {/* "Window" light from behind the camera shining onto wall_north +
            wall_west + floor. Position is in the +Z hemisphere so the wall
            we're looking at receives the light, not its back face. */}
        <directionalLight
          position={[1.8, 2.6, 2.2]}
          intensity={0.95}
          color="#fff1d6"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        {ready && room && <RoomScene room={room} surfaces={surfaces} />}
      </Canvas>
    </div>
  );
}
