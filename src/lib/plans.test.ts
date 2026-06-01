import { describe, expect, it } from "vitest";
import { PLAN_CARDS } from "./plans";
import type { Tier } from "./entitlements";

describe("PLAN_CARDS (issue #105)", () => {
  it("lists the three Plans in upgrade order", () => {
    expect(PLAN_CARDS.map((p) => p.tier)).toEqual<Tier[]>([
      "explorer",
      "resident",
      "studio",
    ]);
  });

  it("frames Explorer as the free baseline", () => {
    const explorer = PLAN_CARDS.find((p) => p.tier === "explorer");
    expect(explorer?.price).toBe("Free");
  });

  it("gives every Plan a name and perks", () => {
    for (const plan of PLAN_CARDS) {
      expect(plan.name.length).toBeGreaterThan(0);
      expect(plan.perks.length).toBeGreaterThan(0);
    }
  });
});
