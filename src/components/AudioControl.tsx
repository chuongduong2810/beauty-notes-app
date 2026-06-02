import type { CSSProperties } from "react";
import { useAppStore } from "../store";
import { AMBIENT_TRACKS } from "../lib/ambient-audio";

/**
 * Ambient soundscape control (ADR-0024, issue #128) — the chrome affordance for
 * the single User-controllable facet of the otherwise-fixed Weather. A small
 * speaker button in the bottom-right corner toggles the soundscape via
 * `toggleAudio` (the first tap is the user gesture that satisfies the browser
 * autoplay policy); while enabled, the 3-track selector appears above it,
 * calling `setAudioTrack` and highlighting the active track. The actual
 * playback lives in the headless AmbientAudio component.
 *
 * Unobtrusive corner placement (bottom-right) keeps it clear of the other
 * chrome — RoomPicker (top-left), ToolPalette (top-center) and the
 * CustomizationPanel (bottom-left) — and it never overlays the scene, so
 * note-taking is never blocked. Styling follows the same glass vocabulary as
 * ToolPalette / CustomizationPanel so the chrome reads as a set.
 */

const containerStyle: CSSProperties = {
  position: "fixed",
  bottom: 16,
  right: 16,
  zIndex: 10,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
  userSelect: "none",
};

const selectorStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: 6,
  borderRadius: 12,
  border: "1px solid rgba(255, 255, 255, 0.08)",
  background: "rgba(20, 16, 28, 0.92)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  boxShadow: "0 10px 32px rgba(0,0,0,0.45)",
};

const trackButtonBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 12px",
  borderRadius: 999,
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.72)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "right",
  transition: "background 120ms ease, color 120ms ease",
};

const trackButtonActive: CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  color: "#1a1626",
};

const speakerStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 999,
  border: "1px solid rgba(255, 255, 255, 0.08)",
  background: "rgba(20, 16, 28, 0.72)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
  color: "rgba(255,255,255,0.92)",
  fontSize: 18,
  cursor: "pointer",
};

export function AudioControl() {
  const audioEnabled = useAppStore((s) => s.audioEnabled);
  const audioTrackId = useAppStore((s) => s.audioTrackId);
  const toggleAudio = useAppStore((s) => s.toggleAudio);
  const setAudioTrack = useAppStore((s) => s.setAudioTrack);

  return (
    <div style={containerStyle} data-testid="audio-control">
      {audioEnabled && (
        <div style={selectorStyle} role="group" aria-label="Soundscape track">
          {AMBIENT_TRACKS.map((track) => {
            const active = track.id === audioTrackId;
            return (
              <button
                key={track.id}
                type="button"
                aria-pressed={active}
                style={{
                  ...trackButtonBase,
                  ...(active ? trackButtonActive : null),
                }}
                onClick={() => setAudioTrack(track.id)}
              >
                {track.label}
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        aria-label={audioEnabled ? "Mute soundscape" : "Play soundscape"}
        aria-pressed={audioEnabled}
        title={audioEnabled ? "Mute soundscape" : "Play soundscape"}
        style={speakerStyle}
        onClick={() => toggleAudio()}
      >
        <span aria-hidden>{audioEnabled ? "🔊" : "🔈"}</span>
      </button>
    </div>
  );
}
