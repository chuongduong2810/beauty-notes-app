import {
  EffectComposer,
  Bloom,
  DepthOfField,
  SSAO,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { atmosphereConfig } from "../lib/atmosphere-config";
import { useAppStore } from "../store";

/**
 * Postprocessing chain for issues #20 + #34: subtle always-on Bloom,
 * DOF that activates when a Note is focused, and SSAO contact-shadow
 * darkening under visible Notes.
 *
 * The decision logic lives in `atmosphereConfig` (tested separately).
 * This component is the thin JSX wiring that feeds those numbers into
 * the EffectComposer passes.
 *
 * Pointer-event note: a prior attempt to wire postprocessing in App.tsx
 * broke click-to-focus (S237). The fixes here that should keep raycasts
 * working: (1) `multisampling={0}` — avoids the MSAA render-target
 * swap that interferes with R3F's event pipeline on some drivers;
 * (2) the composer is mounted as the LAST child of `<Canvas>` so it
 * runs after the scene is fully populated.
 *
 * SSAO is preferred over n8ao here because `@react-three/postprocessing`
 * exports it as a first-class typed component — same contact-shadow
 * purpose, no third-party wrapper needed.
 */
export function Atmosphere() {
  const focusedNoteId = useAppStore((s) => s.focusedNoteId);
  const notesVisible = useAppStore((s) => s.notes.length > 0);
  const cfg = atmosphereConfig({
    focused: focusedNoteId !== null,
    notesVisible,
  });

  return (
    <EffectComposer multisampling={0}>
      <DepthOfField
        focusDistance={0}
        focalLength={0.02}
        bokehScale={cfg.bokehScale}
        height={480}
      />
      <SSAO
        blendFunction={BlendFunction.MULTIPLY}
        samples={16}
        radius={0.05}
        intensity={cfg.aoIntensity}
        bias={0.025}
        worldDistanceThreshold={4}
        worldDistanceFalloff={1}
        worldProximityThreshold={0.5}
        worldProximityFalloff={0.1}
      />
      <Bloom
        intensity={cfg.bloomIntensity}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.4}
        mipmapBlur
      />
    </EffectComposer>
  );
}
