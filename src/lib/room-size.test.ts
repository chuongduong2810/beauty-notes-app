import { describe, expect, it } from "vitest";
import {
  ROOM_SIZE_PRESETS,
  roomSizePresetById,
  appliedRoomSizePresetId,
} from "./room-size";

describe("room-size presets (room resize, Studio)", () => {
  it("ships a Standard preset matching the default 6 × 6 × 3 Room", () => {
    const standard = roomSizePresetById("standard");
    expect(standard).toMatchObject({ width_m: 6, depth_m: 6, height_m: 3 });
  });

  it("resolves the applied preset from a Room's dimensions", () => {
    const grand = roomSizePresetById("grand")!;
    expect(
      appliedRoomSizePresetId({
        width_m: grand.width_m,
        depth_m: grand.depth_m,
        height_m: grand.height_m,
      }),
    ).toBe("grand");
  });

  it("treats a Room whose dimensions match no preset as Custom (null)", () => {
    expect(
      appliedRoomSizePresetId({ width_m: 5.1, depth_m: 6, height_m: 3 }),
    ).toBeNull();
  });

  it("exposes presets in ascending floor-area order for display", () => {
    const areas = ROOM_SIZE_PRESETS.map((p) => p.width_m * p.depth_m);
    expect(areas).toEqual([...areas].sort((a, b) => a - b));
  });
});
