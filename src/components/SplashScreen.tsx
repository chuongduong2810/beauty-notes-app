import { useEffect, useState } from "react";
import { useAppStore } from "../store";

/**
 * Animated HUD-style splash that overlays the canvas while the Room
 * bootstraps (auth, ensureInitialRoom, Notes + Annotations fetch).
 *
 * Mount-and-forget: subscribes to `ready` on the store, fades itself
 * out when ready flips true, then unmounts after the fade-out
 * animation completes so it stops consuming pointer events.
 *
 * All styling lives in `index.html` under `.splash-*` so the same
 * neon-cyan look is shared with the HoverTooltip and any future HUD
 * elements.
 */
const FADE_OUT_MS = 600;

export function SplashScreen() {
  const ready = useAppStore((s) => s.ready);
  const [mounted, setMounted] = useState(true);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (!ready) return;
    // Start the fade, then unmount once the CSS transition finishes
    // so the splash stops absorbing pointer-events from the canvas.
    setHiding(true);
    const t = setTimeout(() => setMounted(false), FADE_OUT_MS);
    return () => clearTimeout(t);
  }, [ready]);

  if (!mounted) return null;

  return (
    <div className={`splash ${hiding ? "splash--hiding" : ""}`}>
      <div className="splash__scan" />
      <div className="splash__content">
        <div className="splash__ring" aria-hidden="true">
          <div className="splash__ring-arc" />
          <div className="splash__ring-dot" />
        </div>
        <div className="splash__wordmark">SPATIAL CREATIVE WORKSPACE</div>
        <div className="splash__status">
          <span className="splash__status-prompt">&gt;</span>
          <span className="splash__status-text">Booting Room</span>
          <span className="splash__status-caret" />
        </div>
        <div className="splash__bar" aria-hidden="true">
          <div className="splash__bar-fill" />
        </div>
      </div>
    </div>
  );
}
