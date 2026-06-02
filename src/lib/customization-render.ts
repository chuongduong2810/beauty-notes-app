/**
 * Pure render-mapping for per-Room Customization (ADR-0022). Issue #107 wired
 * the persistence + the Theme tint; this maps the remaining Catalog kinds —
 * Lighting, Ambience, Window Style — to concrete render parameters the scene
 * components consume. Kept renderer-free and side-effect-free so the
 * id → params mapping is unit-testable without an R3F canvas.
 *
 * Each resolver takes a Room's Catalog id (or null/undefined for "default")
 * and returns either an override or a sentinel meaning "leave the baseline
 * untouched" — so an un-customized Room renders exactly as before. Furniture
 * is an additive set rendered piece-by-piece in `RoomFurniture`, so it needs
 * no value map here.
 */

/** Key-light override for a Lighting Item (composed over weather defaults). */
export type LightingRender = { color: string; intensity: number };

/**
 * Resolve the key-light override for a Lighting Catalog id. Returns `null` for
 * the free "Daylight" default (or an unknown/absent id), meaning "keep the
 * baseline weather lighting" so an un-lit Room is unchanged.
 */
export function lightingRender(
  id: string | null | undefined,
): LightingRender | null {
  switch (id) {
    case "golden-hour":
      return { color: "#ffd08a", intensity: 1.05 };
    case "candlelit":
      return { color: "#ff9d5c", intensity: 0.65 };
    case "studio-spot":
      return { color: "#ffffff", intensity: 1.45 };
    default:
      return null;
  }
}

/** A tinted ambient wash for an Ambience Item, layered over the Weather mood. */
export type AmbienceRender = { color: string; intensity: number };

/**
 * Resolve the ambient-tint wash for an Ambience Catalog id. Returns `null` for
 * the free "Quiet" default (or an unknown/absent id), meaning "no extra wash"
 * — the baseline rainy Weather mood (ADR-0015) stands alone.
 */
export function ambienceRender(
  id: string | null | undefined,
): AmbienceRender | null {
  switch (id) {
    case "rainy-jazz":
      return { color: "#6a7fb0", intensity: 0.28 };
    case "forest-dawn":
      return { color: "#8fb98a", intensity: 0.24 };
    case "deep-focus":
      return { color: "#5b6168", intensity: 0.2 };
    default:
      return null;
  }
}

/** Window glass appearance for a Window Style Item. */
export type WindowRender = {
  /** Glass sheen tint (hex). */
  glassTint: string;
  /** Glass sheen opacity — higher reads as coloured/stained glass. */
  glassOpacity: number;
  /** Whether to add an arched crown over the opening. */
  arched: boolean;
};

const PLAIN_WINDOW: WindowRender = {
  glassTint: "#bcd2e0",
  glassOpacity: 0.06,
  arched: false,
};

/**
 * Resolve the Window glass appearance for a Window Style Catalog id. Always
 * returns a config; the free "Plain Pane" default (or an unknown/absent id)
 * yields the unchanged baseline glass.
 */
export function windowRender(id: string | null | undefined): WindowRender {
  switch (id) {
    case "arched":
      return { ...PLAIN_WINDOW, arched: true };
    case "stained-glass":
      return { glassTint: "#7ea6c9", glassOpacity: 0.26, arched: false };
    default:
      return PLAIN_WINDOW;
  }
}
