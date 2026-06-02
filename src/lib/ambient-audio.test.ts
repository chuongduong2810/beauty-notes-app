import { describe, it, expect } from "vitest";
import {
  AMBIENT_TRACKS,
  AMBIENT_VOLUME,
  DEFAULT_AUDIO_TRACK_ID,
  ambientTrackById,
} from "./ambient-audio";

describe("ambient-audio catalog (ADR-0024)", () => {
  it("has the three tracks with the expected ids and srcs", () => {
    expect(AMBIENT_TRACKS.map((t) => t.id)).toEqual([
      "forest",
      "music",
      "old-house",
    ]);
    expect(AMBIENT_TRACKS.map((t) => t.src)).toEqual([
      "/audio/forest.mp3",
      "/audio/music1.mp3",
      "/audio/soundreality-ambient-old-house-496466.mp3",
    ]);
  });

  it("looks a track up by id", () => {
    expect(ambientTrackById("music")?.src).toBe("/audio/music1.mp3");
  });

  it("returns undefined for an unknown id", () => {
    expect(ambientTrackById("nope")).toBeUndefined();
  });

  it("resolves the default track id to a real track (the forest track)", () => {
    expect(DEFAULT_AUDIO_TRACK_ID).toBe("forest");
    expect(ambientTrackById(DEFAULT_AUDIO_TRACK_ID)).toBeDefined();
  });

  it("uses a low ambient volume", () => {
    expect(AMBIENT_VOLUME).toBeGreaterThan(0);
    expect(AMBIENT_VOLUME).toBeLessThan(1);
  });
});
