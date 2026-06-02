import { useEffect, useRef } from "react";
import { useAppStore } from "../store";
import {
  AMBIENT_VOLUME,
  ambientTrackById,
} from "../lib/ambient-audio";

/**
 * Headless playback driver for the ambient soundscape (ADR-0024, issue #128).
 * Owns a single `HTMLAudioElement`, reads `audioEnabled` + `audioTrackId` from
 * the store, and:
 *  - on enable → loads the chosen track's `src` and `play()`s it (the first
 *    enable is always a user gesture via the speaker control, so the browser
 *    autoplay policy is satisfied);
 *  - on disable → `pause()`s;
 *  - on track change while enabled → swaps `src` and keeps playing.
 * Loops at a low ambient volume (ADR-0024). Session-only: nothing is persisted,
 * so a reload starts silent. Renders no visible UI.
 *
 * Guarded for SSR / non-DOM (jsdom does not implement `HTMLMediaElement.play`,
 * so do NOT render this component in tests) and the `play()` promise rejection
 * is swallowed so a blocked/interrupted play never throws.
 */
export function AmbientAudio() {
  const audioEnabled = useAppStore((s) => s.audioEnabled);
  const audioTrackId = useAppStore((s) => s.audioTrackId);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create the single audio element once, on the client only.
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const audio = new Audio();
    audio.loop = true;
    audio.volume = AMBIENT_VOLUME;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  // Drive play/pause + track selection off the store flags.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audioEnabled) {
      audio.pause();
      return;
    }

    const track = ambientTrackById(audioTrackId);
    if (!track) return;

    // Swap the source only when it actually changed, so re-enabling the same
    // track resumes rather than restarting from the top on every render.
    const nextSrc = new URL(track.src, window.location.href).href;
    if (audio.src !== nextSrc) {
      audio.src = track.src;
    }

    // The play() promise rejects when the gesture/permission is missing or the
    // load is interrupted by a quick toggle — swallow it so it never throws.
    const playback = audio.play();
    if (playback) {
      playback.catch(() => {
        /* autoplay blocked or interrupted — stay silent, no throw */
      });
    }
  }, [audioEnabled, audioTrackId]);

  return null;
}
