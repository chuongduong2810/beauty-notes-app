/**
 * The in-code ambient soundscape catalog (ADR-0024). The soundscape is the
 * single User-controllable facet of the otherwise-fixed Weather (ADR-0015):
 * off by default, started by a user gesture (so the browser autoplay policy
 * never blocks it), looping at a low ambient volume, and session-only — the
 * chosen track and on/off state live in the store, are NOT persisted, and reset
 * to silent on reload. It is FREE (not gated behind premium/Ambience).
 *
 * Following the product's "catalog as data, reference by id" philosophy (the
 * Palette stores `color_id`s, the Catalog stores Item ids — never raw values),
 * a track is referenced by its stable `id` rather than a raw file path. Kept
 * renderer-free and side-effect-free so the lookup rules are unit-testable
 * without the store or an `HTMLAudioElement`.
 */

/**
 * A single ambient track. `id` is what the store holds; `label` is the display
 * name shown in the selector; `src` is the runtime path served from
 * `public/audio/` (the mp3s are committed on PR #126, not in this module).
 */
export type AmbientTrack = {
  id: string;
  label: string;
  /** Runtime path under `public/audio/` (e.g. `/audio/forest.mp3`). */
  src: string;
};

/**
 * The curated soundscape tracks, in display order. The first (forest) is the
 * default. `src` points at the assets served from `public/audio/`.
 */
export const AMBIENT_TRACKS: readonly AmbientTrack[] = [
  { id: "forest", label: "Forest", src: "/audio/forest.mp3" },
  { id: "music", label: "Soft Music", src: "/audio/music1.mp3" },
  {
    id: "old-house",
    label: "Old House",
    src: "/audio/soundreality-ambient-old-house-496466.mp3",
  },
] as const;

/**
 * The default track id — the forest soundscape, the first track. A fresh store
 * starts on this track (though silent until the User enables playback).
 */
export const DEFAULT_AUDIO_TRACK_ID = AMBIENT_TRACKS[0].id;

/**
 * Low ambient playback volume (0–1) for the looping soundscape — quiet enough
 * to sit under note-taking without competing with it (ADR-0024).
 */
export const AMBIENT_VOLUME = 0.35;

/**
 * Look up a single track by id.
 *
 * @param id - an ambient track id (as held in the store).
 * @returns the matching track, or `undefined` if the id is unknown.
 */
export function ambientTrackById(id: string): AmbientTrack | undefined {
  return AMBIENT_TRACKS.find((track) => track.id === id);
}
