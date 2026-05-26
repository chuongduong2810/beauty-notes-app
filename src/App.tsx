import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { supabase } from "./lib/supabase";
import { supabaseCanvasRepository } from "./lib/supabase-canvas-repository";
import { ensureInitialCanvas } from "./lib/ensure-initial-canvas";
import { useAppStore } from "./store";
import { Note } from "./components/Note";

const SKY_GRADIENT =
  "radial-gradient(ellipse at 50% 30%, #1f1733 0%, #0e0b16 70%)";

export function App() {
  const ready = useAppStore((s) => s.ready);
  const notes = useAppStore((s) => s.notes);
  const setSession = useAppStore((s) => s.setSession);
  const setCanvas = useAppStore((s) => s.setCanvas);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      const { data: { session: existing } } = await supabase.auth.getSession();
      let session = existing;
      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        session = data.session;
      }
      if (!session || cancelled) return;
      setSession(session);
      const repo = supabaseCanvasRepository(supabase);
      const { canvas, notes } = await ensureInitialCanvas(repo, session.user.id);
      if (cancelled) return;
      setCanvas(canvas, notes);
    };
    bootstrap().catch((err) => console.error("Bootstrap failed:", err));
    return () => {
      cancelled = true;
    };
  }, [setSession, setCanvas]);

  return (
    <div style={{ position: "fixed", inset: 0, background: SKY_GRADIENT }}>
      <Canvas camera={{ position: [0, 0, 400], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 200, 300]} intensity={0.7} />
        {ready && notes.map((n) => <Note key={n.id} note={n} />)}
      </Canvas>
    </div>
  );
}
