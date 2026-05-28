import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useDebugStore } from "../lib/debug-store";

/**
 * Reads OrbitControls + camera state every frame and pushes to the
 * debug store. Logs the camera-to-target distance before/after each
 * wheel event so we can see whether the wheel is actually dollying
 * the camera or being absorbed somewhere.
 *
 * Must be a child of `<Canvas>` (uses useFrame + useThree).
 */
export function ZoomDebugProbe({
  orbitRef,
}: {
  orbitRef: React.MutableRefObject<OrbitControlsImpl | null>;
}) {
  const update = useDebugStore((s) => s.update);
  const { gl } = useThree();

  useFrame(() => {
    const c = orbitRef.current;
    if (!c) return;
    const cam = c.object as PerspectiveCamera;
    update({
      cam: [cam.position.x, cam.position.y, cam.position.z],
      target: [c.target.x, c.target.y, c.target.z],
      distance: cam.position.distanceTo(c.target),
      minDistance: c.minDistance,
      maxDistance: c.maxDistance,
      zoomToCursor: (c as { zoomToCursor?: boolean }).zoomToCursor ?? false,
      cameraNear: cam.near,
      cameraFar: cam.far,
      enabled: c.enabled,
    });
  });

  useEffect(() => {
    const dom = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      const rect = dom.getBoundingClientRect();
      const ndc: [number, number] = [
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      ];
      const c = orbitRef.current;
      const distBefore = c
        ? c.object.position.distanceTo(c.target)
        : 0;
      // Schedule a post-frame read so we see the camera state AFTER
      // OrbitControls processed this wheel tick.
      requestAnimationFrame(() => {
        const distAfter = c
          ? c.object.position.distanceTo(c.target)
          : 0;
        update({
          lastWheelDelta: e.deltaY,
          lastWheelCursor: ndc,
          lastDistBefore: distBefore,
          lastDistAfter: distAfter,
        });
        // eslint-disable-next-line no-console
        console.log("[zoom-debug] wheel", {
          deltaY: e.deltaY,
          ndc: ndc.map((n) => +n.toFixed(3)),
          distBefore: +distBefore.toFixed(4),
          distAfter: +distAfter.toFixed(4),
          delta: +(distBefore - distAfter).toFixed(4),
          zoomToCursor:
            (c as unknown as { zoomToCursor?: boolean })?.zoomToCursor,
          enabled: c?.enabled,
        });
      });
    };
    dom.addEventListener("wheel", onWheel, { passive: true });
    return () => dom.removeEventListener("wheel", onWheel);
  }, [gl, orbitRef, update]);

  return null;
}

const f = (n: number) => n.toFixed(3);

/**
 * Live HUD readout of zoom-relevant state. Outside `<Canvas>` so it
 * renders as a fixed DOM overlay independent of R3F's render loop.
 */
export function ZoomDebugOverlay() {
  const stats = useDebugStore();
  return (
    <div
      style={{
        position: "fixed",
        top: 80,
        right: 16,
        padding: "10px 14px",
        background: "rgba(10, 12, 22, 0.88)",
        color: "#5cf2e8",
        fontFamily: '"JetBrains Mono", "SF Mono", Menlo, monospace',
        fontSize: 11,
        lineHeight: 1.5,
        zIndex: 50,
        borderRadius: 6,
        border: "1px solid rgba(92, 242, 232, 0.4)",
        boxShadow: "0 0 14px rgba(92, 242, 232, 0.18)",
        pointerEvents: "none",
        whiteSpace: "pre",
        userSelect: "none",
      }}
    >
{`ZOOM DEBUG
cam       [${f(stats.cam[0])}, ${f(stats.cam[1])}, ${f(stats.cam[2])}]
target    [${f(stats.target[0])}, ${f(stats.target[1])}, ${f(stats.target[2])}]
distance  ${f(stats.distance)} m
min/max   ${f(stats.minDistance)} / ${
        stats.maxDistance === Infinity ? "∞" : f(stats.maxDistance)
      }
near/far  ${f(stats.cameraNear)} / ${f(stats.cameraFar)}
zoom2cur  ${stats.zoomToCursor ? "ON" : "OFF"}
enabled   ${stats.enabled}
wheel     Δ${stats.lastWheelDelta}  NDC(${f(stats.lastWheelCursor[0])}, ${f(
        stats.lastWheelCursor[1],
      )})
dist Δ    ${f(stats.lastDistBefore)} → ${f(stats.lastDistAfter)}   (Δ ${f(
        stats.lastDistBefore - stats.lastDistAfter,
      )})`}
    </div>
  );
}
