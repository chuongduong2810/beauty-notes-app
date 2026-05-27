import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { supabase } from "./lib/supabase";
import { supabaseCanvasRepository } from "./lib/supabase-canvas-repository";
import { bootstrapSessionAndCanvas } from "./lib/bootstrap";
import { useAppStore, flushPendingPositionUpdates } from "./store";
import { DraggableNote } from "./components/DraggableNote";
import { CanvasFloor } from "./components/CanvasFloor";
import { UndoToast } from "./components/UndoToast";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";

const SKY_GRADIENT =
  "radial-gradient(ellipse at 50% 30%, #1f1733 0%, #0e0b16 70%)";

export function App() {
  const ready = useAppStore((s) => s.ready);
  const notes = useAppStore((s) => s.notes);
  const setSession = useAppStore((s) => s.setSession);
  const setCanvas = useAppStore((s) => s.setCanvas);
  const setRepo = useAppStore((s) => s.setRepo);

  useGlobalShortcuts();

  useEffect(() => {
    const onOnline = () => void flushPendingPositionUpdates();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  useEffect(() => {
    let cancelled = false;
    bootstrapSessionAndCanvas()
      .then(({ session, canvas, notes }) => {
        if (cancelled) return;
        setSession(session);
        setRepo(supabaseCanvasRepository(supabase));
        setCanvas(canvas, notes);
      })
      .catch((err) => console.error("Bootstrap failed:", err));
    return () => {
      cancelled = true;
    };
  }, [setSession, setCanvas, setRepo]);

  return (
    <div style={{ position: "fixed", inset: 0, background: SKY_GRADIENT }}>
      <Canvas camera={{ position: [0, 0, 400], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 200, 300]} intensity={0.7} />
        <CanvasFloor />
        {ready && notes.map((n) => <DraggableNote key={n.id} note={n} />)}
      </Canvas>
      <UndoToast />
    </div>
  );
}
