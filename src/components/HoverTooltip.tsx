import { Html } from "@react-three/drei";

/**
 * A "futuristic toast" tooltip anchored at a 3D point — meant for any
 * interactive prop in the Room (issue #35 follow-up). Rendered via
 * drei's `<Html>` so the DOM card always faces the camera and stays
 * crisp at any zoom.
 *
 * The caller owns the hover state and toggles `visible`. The tooltip
 * is fully `pointer-events: none` so it never intercepts a click meant
 * for the prop underneath. Styling lives in index.html (`.hover-toast`)
 * so the same look is reusable for future interactive items.
 */
export function HoverTooltip({
  visible,
  title,
  subtitle,
  position = [0, 0.06, 0],
  distanceFactor = 1.2,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Local 3D offset from the parent — typically a small +Y bump so
   *  the toast hovers above the prop. */
  position?: [number, number, number];
  /** drei's distanceFactor — controls perspective scaling. Lower
   *  values keep the toast a constant pixel size, higher values let
   *  it shrink with distance. */
  distanceFactor?: number;
}) {
  if (!visible) return null;
  return (
    <Html
      position={position}
      center
      distanceFactor={distanceFactor}
      zIndexRange={[100, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div className="hover-toast" role="tooltip">
        <div className="hover-toast__title">{title}</div>
        {subtitle && <div className="hover-toast__subtitle">{subtitle}</div>}
      </div>
    </Html>
  );
}
