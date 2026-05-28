import { describe, it, expect } from "vitest";
import { atmosphereConfig } from "./atmosphere-config";

describe("atmosphereConfig", () => {
  it("returns bokehScale === 0 when unfocused (no DOF blur during room view)", () => {
    const cfg = atmosphereConfig({ focused: false });
    expect(cfg.bokehScale).toBe(0);
  });

  it("returns bokehScale > 0 when focused (DOF blur active in Focus mode)", () => {
    const cfg = atmosphereConfig({ focused: true });
    expect(cfg.bokehScale).toBeGreaterThan(0);
  });

  it("is pure: same input always yields the same output", () => {
    expect(atmosphereConfig({ focused: false })).toEqual(
      atmosphereConfig({ focused: false }),
    );
    expect(atmosphereConfig({ focused: true })).toEqual(
      atmosphereConfig({ focused: true }),
    );
  });

  it("bloom is subtle and always on (issue #20: 'no over-the-top glow')", () => {
    const cfgUnfocused = atmosphereConfig({ focused: false });
    const cfgFocused = atmosphereConfig({ focused: true });
    // Always on — even during room view we want the warm highlight lift.
    expect(cfgUnfocused.bloomIntensity).toBeGreaterThan(0);
    expect(cfgFocused.bloomIntensity).toBeGreaterThan(0);
    // Subtle ceiling. 0.3 is well below "glow" territory for the
    // postprocessing Bloom effect.
    expect(cfgUnfocused.bloomIntensity).toBeLessThanOrEqual(0.3);
    expect(cfgFocused.bloomIntensity).toBeLessThanOrEqual(0.3);
  });
});
