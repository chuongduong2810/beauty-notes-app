import { describe, it, expect } from "vitest";
import { atmosphereConfig } from "./atmosphere-config";

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
