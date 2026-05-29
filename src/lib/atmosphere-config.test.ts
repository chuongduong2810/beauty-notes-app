import { describe, it, expect } from "vitest";
import {
  atmosphereConfig,
  weatherLightingConfig,
  WARM_KEY_LIGHT_COLOR,
  WARM_KEY_LIGHT_INTENSITY,
} from "./atmosphere-config";

describe("atmosphereConfig", () => {
  it("returns bokehScale === 0 when unfocused (no DOF blur during room view)", () => {
    const cfg = atmosphereConfig({ focused: false, notesVisible: true });
    expect(cfg.bokehScale).toBe(0);
  });

  it("returns bokehScale > 0 when focused (DOF blur active in Focus mode)", () => {
    const cfg = atmosphereConfig({ focused: true, notesVisible: true });
    expect(cfg.bokehScale).toBeGreaterThan(0);
  });

  it("is pure: same input always yields the same output", () => {
    expect(atmosphereConfig({ focused: false, notesVisible: true })).toEqual(
      atmosphereConfig({ focused: false, notesVisible: true }),
    );
    expect(atmosphereConfig({ focused: true, notesVisible: false })).toEqual(
      atmosphereConfig({ focused: true, notesVisible: false }),
    );
  });

  it("bloom is subtle and always on (issue #20: 'no over-the-top glow')", () => {
    const cfgUnfocused = atmosphereConfig({ focused: false, notesVisible: true });
    const cfgFocused = atmosphereConfig({ focused: true, notesVisible: true });
    // Always on — even during room view we want the warm highlight lift.
    expect(cfgUnfocused.bloomIntensity).toBeGreaterThan(0);
    expect(cfgFocused.bloomIntensity).toBeGreaterThan(0);
    // Subtle ceiling. 0.3 is well below "glow" territory for the
    // postprocessing Bloom effect.
    expect(cfgUnfocused.bloomIntensity).toBeLessThanOrEqual(0.3);
    expect(cfgFocused.bloomIntensity).toBeLessThanOrEqual(0.3);
  });

  it("aoIntensity === 0 when no Notes are visible (cheap optimization)", () => {
    const cfg = atmosphereConfig({ focused: false, notesVisible: false });
    expect(cfg.aoIntensity).toBe(0);
  });

  it("aoIntensity is on and tuned (subtle contact shadow) when Notes are visible", () => {
    const cfg = atmosphereConfig({ focused: false, notesVisible: true });
    // Visible — the contact line under each Note is the whole point.
    expect(cfg.aoIntensity).toBeGreaterThan(0);
    // Not crushing — anything above 1.5 darkens the warm-white walls into
    // mud and reads as a Photoshop drop-shadow, not contact shadow.
    expect(cfg.aoIntensity).toBeLessThanOrEqual(1.5);
  });
});

/** Parse a `#rrggbb` string into normalized 0..1 RGB channels. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.replace("#", ""), 16);
  return {
    r: ((n >> 16) & 0xff) / 255,
    g: ((n >> 8) & 0xff) / 255,
    b: (n & 0xff) / 255,
  };
}

describe("weatherLightingConfig (overcast Weather — issue #45, ADR-0015)", () => {
  const cfg = weatherLightingConfig();

  it("is pure: takes no input and always yields the same output", () => {
    expect(weatherLightingConfig()).toEqual(weatherLightingConfig());
  });

  it("key light reads COOLER than the prior warm tone (more blue, less red)", () => {
    const warm = hexToRgb(WARM_KEY_LIGHT_COLOR);
    const overcast = hexToRgb(cfg.keyLightColor);
    // Overcast daylight shifts toward blue: the blue-to-red ratio must
    // rise relative to the warm ~3000 K tone.
    const warmRatio = warm.b / warm.r;
    const overcastRatio = overcast.b / overcast.r;
    expect(overcastRatio).toBeGreaterThan(warmRatio);
  });

  it("key light is slightly DIMMER than the prior warm intensity", () => {
    expect(cfg.keyLightIntensity).toBeLessThan(WARM_KEY_LIGHT_INTENSITY);
    // ...but still the dominant light — not a dramatic blackout.
    expect(cfg.keyLightIntensity).toBeGreaterThan(WARM_KEY_LIGHT_INTENSITY * 0.6);
  });

  it("provides a FAINT cool window fill", () => {
    const fill = hexToRgb(cfg.windowFillColor);
    // Cool: blue channel is the strongest of the three.
    expect(fill.b).toBeGreaterThan(fill.r);
    expect(fill.b).toBeGreaterThanOrEqual(fill.g);
    // Faint: a soft spill, never overpowering the key light.
    expect(cfg.windowFillIntensity).toBeGreaterThan(0);
    expect(cfg.windowFillIntensity).toBeLessThan(cfg.keyLightIntensity);
  });

  it("the fill is associated with the Window direction (-X / wall_west)", () => {
    // The Window lives on wall_west (x = -width/2), so a fill spilling
    // from it points generally toward -X.
    expect(cfg.windowFillDirection[0]).toBeLessThan(0);
  });

  it("is subtle and calming — no flash/flicker knobs, just static constants", () => {
    // Sanity: the config is a flat bag of numbers/strings, nothing that
    // could animate a lightning flash.
    expect(typeof cfg.keyLightIntensity).toBe("number");
    expect(typeof cfg.windowFillIntensity).toBe("number");
  });
});
