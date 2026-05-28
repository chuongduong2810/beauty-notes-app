import { Html } from "@react-three/drei";

/**
 * A "futuristic toast" tooltip anchored at a 3D point — meant for any
 * interactive prop in the Room (issue #35 follow-up).
 *
 * Rendered via drei's `<Html>` with `center` (no transform mode) so
 * the wrapper is a tiny screen-space DOM card positioned at the 3D
 * anchor — this avoids the matrix3d wrapper covering the viewport
 * and silently swallowing the pointer events that drive the parent
 * mesh's hover handlers.
 *
 * The "3D / futuristic" feel comes entirely from CSS: floating bob,
 * pulsing neon border, scanline shimmer, blinking terminal cursor on
 * the subtitle, and HUD corner brackets all live in index.html under
 * `.hover-toast*`. Combined they read as a live HUD overlay rather
 * than a static label.
 *
 * The caller owns the hover state and toggles `visible`. The drei
 * `pointerEvents="none"` prop AND the inline style both set
 * pointer-events off so the toast can never block a click meant for
 * the prop underneath.
 */
export function HoverTooltip({
  visible,
  title,
  subtitle,
  position = [0, 0.08, 0],
  distanceFactor = 0.4,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Local 3D offset from the parent — typically a small +Y bump so
   *  the toast hovers above the prop with enough gap that the
   *  triangle pointer doesn't overlap the geometry. */
  position?: [number, number, number];
  /** drei perspective-scaling factor. Lower = the toast shrinks more
   *  with camera distance (more "in the scene"); higher = more
   *  stable pixel size. 0.4 keeps the HUD readable from across the
   *  Room without ballooning when the user dollies in close. */
  distanceFactor?: number;
}) {
  if (!visible) return null;
  return (
    <Html
      position={position}
      center
      distanceFactor={distanceFactor}
      zIndexRange={[100, 0]}
      pointerEvents="none"
      style={{ pointerEvents: "none" }}
    >
      <div className="hover-toast" role="tooltip">
        <span className="hover-toast__bracket hover-toast__bracket--tl" />
        <span className="hover-toast__bracket hover-toast__bracket--tr" />
        <span className="hover-toast__bracket hover-toast__bracket--bl" />
        <span className="hover-toast__bracket hover-toast__bracket--br" />
        <div className="hover-toast__scan" />
        <div className="hover-toast__title">{title}</div>
        {subtitle && (
          <div className="hover-toast__subtitle">
            <span className="hover-toast__subtitle-text">{subtitle}</span>
            <span className="hover-toast__caret" />
          </div>
        )}
      </div>
    </Html>
  );
}
