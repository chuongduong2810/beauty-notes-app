/**
 * Pure config for the postprocessing Atmosphere (issues #20, #34).
 *
 * The render-time `<Atmosphere>` component reads `focusedNoteId` and
 * the visible-Note count from the store, derives `{ focused,
 * notesVisible }`, and feeds the values returned here into the
 * EffectComposer's DepthOfField, N8AO, and Bloom passes. Keeping the
 * decision logic separate from the JSX wiring is what we test.
 */

export type AtmosphereConfig = {
  /** DepthOfField bokeh radius in pixels. 0 disables blur. */
  bokehScale: number;
  /** Bloom intensity. Kept subtle (`<= 0.3`) per the issue brief. */
  bloomIntensity: number;
  /** N8AO ambient-occlusion intensity. 0 when no Notes are visible (#34). */
  aoIntensity: number;
};

/** Bokeh radius in pixels when a Note is focused (ADR-0009: "~6 px"). */
const FOCUSED_BOKEH_SCALE = 6;
/** Subtle baseline bloom — visible warm lift on highlights, no glare. */
const BLOOM_INTENSITY = 0.15;
/** Contact-AO intensity when Notes are visible — visible but not crushing. */
const AO_INTENSITY = 0.8;

export function atmosphereConfig(input: {
  focused: boolean;
  notesVisible: boolean;
}): AtmosphereConfig {
  return {
    bokehScale: input.focused ? FOCUSED_BOKEH_SCALE : 0,
    bloomIntensity: BLOOM_INTENSITY,
    aoIntensity: input.notesVisible ? AO_INTENSITY : 0,
  };
}
