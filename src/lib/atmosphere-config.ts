/**
 * Pure config for the postprocessing Atmosphere (issue #20).
 *
 * The render-time `<Atmosphere>` component reads `focusedNoteId` from the
 * store, derives `{ focused }`, and feeds the values returned here into
 * the EffectComposer's DepthOfField + Bloom passes. Keeping the decision
 * logic separate from the JSX wiring is what we test.
 */

export type AtmosphereConfig = {
  /** DepthOfField bokeh radius in pixels. 0 disables blur. */
  bokehScale: number;
  /** Bloom intensity. Kept subtle (`<= 0.3`) per the issue brief. */
  bloomIntensity: number;
};

/** Bokeh radius in pixels when a Note is focused (ADR-0009: "~6 px"). */
const FOCUSED_BOKEH_SCALE = 6;
/** Subtle baseline bloom — visible warm lift on highlights, no glare. */
const BLOOM_INTENSITY = 0.15;

export function atmosphereConfig(input: {
  focused: boolean;
}): AtmosphereConfig {
  return {
    bokehScale: input.focused ? FOCUSED_BOKEH_SCALE : 0,
    bloomIntensity: BLOOM_INTENSITY,
  };
}
