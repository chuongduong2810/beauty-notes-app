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

/**
 * Weather-driven interior lighting (issue #45, ADR-0015).
 *
 * Weather in v2 is a FIXED always-rainy ambient mood — it is not
 * configurable and not persisted — so this is a pure nullary function
 * returning constants rather than a function of any input. It exists as
 * a sibling to `atmosphereConfig` to keep the same testable seam:
 * App.tsx's `KeyLight` directionalLight and the cool window fill read
 * these values instead of hard-coding magic numbers in JSX.
 *
 * The mood is overcast: the key light shifts cooler and slightly dimmer
 * than the prior warm ~3000 K tone, and a faint cool fill spills in from
 * the Window direction (the Window sits on `wall_west`, i.e. toward -X).
 * Deliberately subtle — no lightning, no flicker, just a calm, cozy,
 * rained-on light.
 */
export type WeatherLightingConfig = {
  /** Key-light colour — cooler than the warm reference (overcast daylight). */
  keyLightColor: string;
  /** Key-light intensity — slightly dimmer than the warm reference. */
  keyLightIntensity: number;
  /** Colour of the faint fill spilling from the Window — cool/blue. */
  windowFillColor: string;
  /** Intensity of the window fill — faint, well below the key light. */
  windowFillIntensity: number;
  /**
   * Direction the window fill light points FROM, in Room space. The
   * Window is on `wall_west` (x = -width/2), so the cool spill comes
   * from -X. Used to place the fill `directionalLight`.
   */
  windowFillDirection: readonly [number, number, number];
};

/**
 * The prior warm ~3000 K key-light tone, kept as the reference the
 * overcast values are tuned against (and asserted relative to in tests).
 * This is the colour App.tsx used before issue #45.
 */
export const WARM_KEY_LIGHT_COLOR = "#ffe2b0";
/** The prior warm key-light intensity, for the same reference reason. */
export const WARM_KEY_LIGHT_INTENSITY = 1.1;

/**
 * Overcast key tone: a soft, slightly blue-shifted daylight white. Still
 * mostly neutral so the Room doesn't read as cold — just no longer warm.
 */
const OVERCAST_KEY_LIGHT_COLOR = "#cfd8e6";
/** Overcast key intensity: a touch dimmer than warm, still the dominant light. */
const OVERCAST_KEY_LIGHT_INTENSITY = 0.9;
/** Faint cool spill from the Window — a desaturated rainy-sky blue. */
const WINDOW_FILL_COLOR = "#9fb4cc";
/** Window fill intensity: a soft hint, never competing with the key light. */
const WINDOW_FILL_INTENSITY = 0.2;
/** Window fill comes from wall_west (-X), angled slightly down into the Room. */
const WINDOW_FILL_DIRECTION: readonly [number, number, number] = [-1, -0.3, 0];

export function weatherLightingConfig(): WeatherLightingConfig {
  return {
    keyLightColor: OVERCAST_KEY_LIGHT_COLOR,
    keyLightIntensity: OVERCAST_KEY_LIGHT_INTENSITY,
    windowFillColor: WINDOW_FILL_COLOR,
    windowFillIntensity: WINDOW_FILL_INTENSITY,
    windowFillDirection: WINDOW_FILL_DIRECTION,
  };
}
