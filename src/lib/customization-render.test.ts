import { describe, expect, it } from "vitest";
import {
  ambienceRender,
  lightingRender,
  windowRender,
} from "./customization-render";

describe("customization-render mapping (issue #108 rendering)", () => {
  it("returns null lighting for the default/absent id so the baseline weather light stands", () => {
    expect(lightingRender("default-lighting")).toBeNull();
    expect(lightingRender(null)).toBeNull();
    expect(lightingRender(undefined)).toBeNull();
  });

  it("maps premium Lighting ids to a key-light override", () => {
    expect(lightingRender("candlelit")).toMatchObject({ color: "#ff9d5c" });
    expect(lightingRender("studio-spot")?.intensity).toBeGreaterThan(1);
  });

  it("returns null ambience for the default/absent id (no extra wash)", () => {
    expect(ambienceRender("default-ambience")).toBeNull();
    expect(ambienceRender(undefined)).toBeNull();
  });

  it("maps premium Ambience ids to a tinted wash", () => {
    expect(ambienceRender("forest-dawn")).toMatchObject({ color: "#8fb98a" });
  });

  it("gives the plain baseline glass for the default id and a flag for arched/stained", () => {
    expect(windowRender("default-window_style").arched).toBe(false);
    expect(windowRender("arched").arched).toBe(true);
    // Stained glass reads as coloured: more opaque than the plain sheen.
    expect(windowRender("stained-glass").glassOpacity).toBeGreaterThan(
      windowRender("default-window_style").glassOpacity,
    );
  });
});
