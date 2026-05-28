import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ACESFilmicToneMapping,
  type DirectionalLight,
  PCFSoftShadowMap,
  Spherical,
  Vector3,
} from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Atmosphere } from "./components/Atmosphere";
import { EditorRectPublisher } from "./components/EditorRectPublisher";
import { NoteEditor } from "./components/NoteEditor";
import { RoomScene } from "./components/RoomScene";
import { RoomFurniture } from "./components/RoomFurniture";
import { SplashScreen } from "./components/SplashScreen";
import { ToolPalette } from "./components/ToolPalette";
import { bootstrapSessionAndRoom } from "./lib/bootstrap";
import { DebouncedSaver } from "./lib/debounced-saver";
import { focusPose } from "./lib/focus-pose";
import { shadowFollowPose } from "./lib/shadow-follow";
import { supabase } from "./lib/supabase";
import { supabaseCanvasRepository } from "./lib/supabase-canvas-repository";
import { useAppStore } from "./store";

const ROOM_BACKDROP = "#0e0b16";

const ORBIT_TARGET: [number, number, number] = [0, 1.5, 0];
/** Free zoom: only clamp at a tiny epsilon so the orbit math doesn't
 *  divide by zero when the camera reaches the orbit target. Beyond
 *  that the user can dolly in and out as far as they like. */
const ORBIT_MIN_DISTANCE = 0.001;
const ORBIT_MAX_DISTANCE = Infinity;
/** Wheel-zoom feels best ~2x the OrbitControls default — anything less
 *  is the user grinding through dozens of wheel ticks to dolly across
 *  a 6 m Room. */
const ORBIT_ZOOM_SPEED = 2.0;
const ORBIT_MIN_POLAR_ANGLE = 0.17;
const ORBIT_MAX_POLAR_ANGLE = Math.PI - 0.17;

const CAMERA_SAVE_DEBOUNCE_MS = 1000;
/** Per-frame interpolation factor for focus-dolly easing. */
const FOCUS_LERP = 0.12;
/** Threshold under which we consider the focus animation "settled". */
const FOCUS_SETTLED_EPS = 0.002;

type CameraPose = { yaw: number; pitch: number; distance: number };

/**
 * Per-frame helper inside <Canvas> that drives the focus transition
 * (issue #17). When `focusedNoteId` is set, this component:
 *  - disables OrbitControls so the user's drags don't fight the dolly
 *  - lerps the Camera position + the OrbitControls target toward the
 *    focus pose
 *  - on un-focus, lerps both back to the snapshot stored in
 *    `beforeFocus` and re-enables OrbitControls when settled
 */
/**
 * The warm "window" key light, with its shadow camera frustum following
 * the orbit target every frame (issue #34). This keeps shadow-map
 * resolution concentrated wherever the user is looking and lets us
 * tighten the frustum bounds for sharper penumbras at the same map size.
 *
 * The light DIRECTION is preserved across orbit moves (see
 * `shadowFollowPose`): the light's position and lookAt translate by the
 * same delta when the orbit target changes, so a Note on the north wall
 * is lit at the same angle whether the user is looking up at it or down.
 */
function KeyLight({
  orbitRef,
}: {
  orbitRef: React.MutableRefObject<OrbitControlsImpl | null>;
}) {
  const lightRef = useRef<DirectionalLight | null>(null);

  useFrame(() => {
    const orbit = orbitRef.current;
    const light = lightRef.current;
    if (!orbit || !light) return;
    const pose = shadowFollowPose([
      orbit.target.x,
      orbit.target.y,
      orbit.target.z,
    ]);
    light.position.set(...pose.position);
    light.target.position.set(...pose.lookAt);
    light.target.updateMatrixWorld();
  });

  return (
    <>
      <directionalLight
        ref={lightRef}
        intensity={1.1}
        color="#ffe2b0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0005}
        shadow-camera-near={0.1}
        shadow-camera-far={6}
        shadow-camera-left={-1.5}
        shadow-camera-right={1.5}
        shadow-camera-top={1.5}
        shadow-camera-bottom={-1.5}
      />
    </>
  );
}

function FocusDriver({
  orbitRef,
}: {
  orbitRef: React.MutableRefObject<OrbitControlsImpl | null>;
}) {
  const focusedNoteId = useAppStore((s) => s.focusedNoteId);
  const beforeFocus = useAppStore((s) => s.beforeFocus);
  const room = useAppStore((s) => s.currentRoom);
  const surfaces = useAppStore((s) => s.surfaces);
  const notes = useAppStore((s) => s.notes);
  const { camera } = useThree();

  // Disable orbit interaction the moment we enter focus mode; re-enable
  // when the un-focus animation has settled.
  useEffect(() => {
    const c = orbitRef.current;
    if (!c) return;
    if (focusedNoteId) c.enabled = false;
  }, [focusedNoteId, orbitRef]);

  useFrame(() => {
    const c = orbitRef.current;
    if (!c || !room) return;

    // Target pose: either the focus pose for the focused Note, or the
    // user's pre-focus snapshot (if we just un-focused), or nothing.
    let targetTarget: [number, number, number] | null = null;
    let targetPos: [number, number, number] | null = null;

    if (focusedNoteId) {
      const note = notes.find((n) => n.id === focusedNoteId);
      const surface = note
        ? surfaces.find((s) => s.id === note.surface_id)
        : null;
      if (note && surface) {
        const pose = focusPose(note, surface, room);
        targetTarget = pose.target;
        targetPos = pose.cameraPosition;
      }
    } else if (beforeFocus && !c.enabled) {
      // Animating back to the user's previous orbit pose.
      targetTarget = beforeFocus.target;
      targetPos = beforeFocus.position;
    }

    if (!targetTarget || !targetPos) return;

    const t = new Vector3(...targetTarget);
    const p = new Vector3(...targetPos);

    c.target.lerp(t, FOCUS_LERP);
    camera.position.lerp(p, FOCUS_LERP);

    const settled =
      c.target.distanceTo(t) < FOCUS_SETTLED_EPS &&
      camera.position.distanceTo(p) < FOCUS_SETTLED_EPS;

    // When the un-focus animation has settled, re-enable orbit so the
    // user can rotate / zoom again. Also clear the snapshot.
    if (settled && !focusedNoteId && !c.enabled) {
      c.target.copy(t);
      camera.position.copy(p);
      c.enabled = true;
      c.update();
      useAppStore.setState({ beforeFocus: null });
    } else {
      c.update();
    }
  });

  return null;
}

export function App() {
  const ready = useAppStore((s) => s.ready);
  const room = useAppStore((s) => s.currentRoom);
  const surfaces = useAppStore((s) => s.surfaces);
  const notes = useAppStore((s) => s.notes);
  const repo = useAppStore((s) => s.repo);
  const focusedNoteId = useAppStore((s) => s.focusedNoteId);
  const setSession = useAppStore((s) => s.setSession);
  const setRepo = useAppStore((s) => s.setRepo);
  const setRoom = useAppStore((s) => s.setRoom);
  const unfocusNote = useAppStore((s) => s.unfocusNote);

  const orbitRef = useRef<OrbitControlsImpl | null>(null);

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

  useEffect(() => {
    if (!cameraSaver) return;
    return () => {
      void cameraSaver.flush();
    };
  }, [cameraSaver]);

  useEffect(() => {
    let cancelled = false;
    bootstrapSessionAndRoom()
      .then(({ session, room, surfaces, notes, annotations }) => {
        if (cancelled) return;
        setSession(session);
        setRepo(supabaseCanvasRepository(supabase));
        setRoom(room, surfaces, notes, annotations);
      })
      .catch((err) => console.error("Bootstrap failed:", err));
    return () => {
      cancelled = true;
    };
  }, [setSession, setRepo, setRoom]);

  // Restore the persisted orbit pose ONCE per Room load. Previously
  // this effect also depended on focusedNoteId + the camera_* fields,
  // which meant: every Escape from focus mode would re-fire it and
  // snap the camera to the persisted pose, overriding FocusDriver's
  // lerp-back to `beforeFocus`. Bug: the camera "zoomed out" but lost
  // the user's yaw/pitch on exit. Depending on room.id alone keeps
  // initial-load behaviour and lets FocusDriver own the unfocus
  // transition cleanly.
  useEffect(() => {
    if (!ready || !room || !orbitRef.current || focusedNoteId) return;
    const controls = orbitRef.current;
    const sph = new Spherical(
      room.camera_distance,
      room.camera_pitch,
      room.camera_yaw,
    );
    const offset = new Vector3().setFromSpherical(sph);
    controls.object.position.copy(controls.target).add(offset);
    controls.update();
    // Deliberately omitting focusedNoteId / camera_* from deps — see
    // comment above. eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, room?.id]);

  // Lock the orbit camera while a Pen Stroke is actively being drawn
  // (#35 follow-up): the user is committing to a continuous gesture on
  // a wall, so a stray drag-orbit mid-stroke would corrupt the polyline.
  //
  // CRITICAL: FocusDriver owns `controls.enabled` both during focus
  // entry AND during the lerp-back to `beforeFocus` on exit. If this
  // effect re-enables orbit the moment `focusedNoteId` clears, the
  // unfocus animation is abandoned mid-flight (FocusDriver's useFrame
  // gates on `!c.enabled`). So we ALSO bail out while `beforeFocus`
  // is still set — that's the "animating back to user's pre-focus
  // pose" window. Only once FocusDriver clears beforeFocus do we
  // resume applying the stroke-lock logic.
  const drawingStroke = useAppStore(
    (s) => s.penState.inProgressStroke !== null,
  );
  const inPenMode = useAppStore((s) => s.penState.currentTool === "pen");
  const beforeFocus = useAppStore((s) => s.beforeFocus);
  useEffect(() => {
    const c = orbitRef.current;
    if (!c) return;
    if (focusedNoteId || beforeFocus) return;
    c.enabled = !drawingStroke;
  }, [drawingStroke, focusedNoteId, beforeFocus]);

  // Escape exits focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focusedNoteId) {
        e.preventDefault();
        unfocusNote();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedNoteId, unfocusNote]);

  const onCameraChange = () => {
    const controls = orbitRef.current;
    if (!controls || !cameraSaver) return;
    // Don't save while focus-driving the camera; that's not the user's
    // intent and we'd clobber their real orbit pose.
    if (focusedNoteId) return;
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

  // Click-to-focus (issue #17). Snapshots the user's CURRENT orbit
  // pose first — `(controls.target, camera.position)` — so the un-focus
  // animation has a real destination to return to.
  //
  // useCallback so the reference is stable across re-renders. Without
  // this every keystroke in the editor cascades into a fresh `onClick`
  // for every NoteMesh, defeating React.memo on NoteMesh.
  const focusNote = useAppStore((s) => s.focusNote);
  const onNoteClick = useCallback(
    (noteId: string) => {
      const controls = orbitRef.current;
      if (!controls) return;
      const cam = controls.object;
      focusNote(noteId, {
        target: [controls.target.x, controls.target.y, controls.target.z],
        position: [cam.position.x, cam.position.y, cam.position.z],
      });
    },
    [focusNote],
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: ROOM_BACKDROP,
        // Hide the system cursor whenever the pen is "in hand" — i.e.
        // the user is in Pen mode, whether actively drawing or just
        // hovering. The 3D pen mesh substitutes as the cursor on the
        // wall (#35).
        cursor: inPenMode ? "none" : undefined,
      }}
    >
      <Canvas
        shadows={{ type: PCFSoftShadowMap }}
        camera={{ position: [0, 1.6, 1.8], fov: 60, near: 0.05, far: 50 }}
        gl={{
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
          antialias: true,
        }}
        onPointerMissed={() => {
          if (focusedNoteId) unfocusNote();
        }}
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
          zoomSpeed={ORBIT_ZOOM_SPEED}
          onChange={onCameraChange}
        />
        <FocusDriver orbitRef={orbitRef} />
        <EditorRectPublisher />
        {/* Warm hemispheric fill — sky from above, slightly cooler floor
            bounce. Low intensity for a calm tone. */}
        <hemisphereLight args={["#ffe6c2", "#4f3f2f", 0.5]} />
        {/* "Window" key light at ~3000 K. Position + shadow frustum
            follow the orbit target every frame (#34) so shadow-map
            resolution stays where the user is looking. */}
        <KeyLight orbitRef={orbitRef} />
        {ready && room && (
          <RoomScene
            room={room}
            surfaces={surfaces}
            notes={notes}
            onNoteClick={onNoteClick}
          />
        )}
        {/* Lamp, desk, plant — small set of primitive-only props so
            the Room reads as a lived-in space. */}
        <RoomFurniture />
        {/* MUST be the last Canvas child — EffectComposer wraps the scene
            it renders. multisampling=0 inside Atmosphere is what keeps
            R3F's pointer raycasting working (the previous attempt to
            wire postprocessing broke click-to-focus — see S237). */}
        <Atmosphere />
      </Canvas>
      <NoteEditor />
      <ToolPalette />
      <SplashScreen />
    </div>
  );
}
