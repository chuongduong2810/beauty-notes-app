import { EffectComposer, Bloom, DepthOfField } from "@react-three/postprocessing";
import { atmosphereConfig } from "../lib/atmosphere-config";
import { useAppStore } from "../store";

/**
 * Postprocessing chain for issue #20: subtle always-on Bloom + DOF that
 * activates when a Note is focused.
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
 */
export function Atmosphere() {
  const focusedNoteId = useAppStore((s) => s.focusedNoteId);
  const cfg = atmosphereConfig({ focused: focusedNoteId !== null });

  return (
    <EffectComposer multisampling={0}>
      <DepthOfField
        focusDistance={0}
        focalLength={0.02}
        bokehScale={cfg.bokehScale}
        height={480}
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
