/**
 * The in-code Palette. The Note schema stores a `color_id` referencing one
 * of these entries — never a raw hex — so the Palette can be retuned globally
 * without a data migration.
 */

export type PaletteEntry = {
  id: string;
  base: string;
  gradient: string;
  shadow: string;
};

export const PALETTE: readonly PaletteEntry[] = [
  { id: "warm-white", base: "#f6efe4", gradient: "#fff9ef", shadow: "#d9c9a9" },
  { id: "paper", base: "#fff4c8", gradient: "#fffbe4", shadow: "#d6c98a" },
  { id: "blush", base: "#f3c8c0", gradient: "#fbe1dc", shadow: "#c47a72" },
  { id: "peach", base: "#f7c79a", gradient: "#fde0c0", shadow: "#c8835a" },
  { id: "mint", base: "#bde1c9", gradient: "#dff1e3", shadow: "#6ea285" },
  { id: "sky", base: "#bcd3ec", gradient: "#dde9f5", shadow: "#6b8fb6" },
  { id: "lilac", base: "#cfc4ea", gradient: "#e6dff5", shadow: "#8676b1" },
] as const;

/** Surface default — warm-white plaster-ish wall colour. */
export const DEFAULT_PALETTE_COLOR_ID = "warm-white";

/** Note default — cream-yellow paper, distinct from the warm-white walls. */
export const DEFAULT_NOTE_COLOR_ID = "paper";

export function paletteEntry(id: string): PaletteEntry {
  return PALETTE.find((p) => p.id === id) ?? PALETTE[0];
}
