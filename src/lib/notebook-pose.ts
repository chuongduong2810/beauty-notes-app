/**
 * Pure pose maths for the desk Notebook (issue #56, ADR-0016).
 *
 * The Notebook's front cover is hinged along the book's spine. Closed,
 * the cover lies flat on the page stack (rotation 0). Open, it swings
 * all the way over (180°) so it lies flat to the left of the spine like
 * a fully-opened book — rather than standing up at an angle, which read
 * as an awkward "wing" sticking up out of the desk.
 *
 * Kept renderer-free so the animation target is unit-testable without
 * an R3F canvas — the component feeds these values into a react-spring
 * `useSpring` (ADR-0007) for the actual motion.
 */

/** Open angle of the front cover, in radians (180° — fully open, flat). */
export const NOTEBOOK_COVER_OPEN_RAD = Math.PI;

/** Cover angle when the book is shut: flat on the page stack. */
export const NOTEBOOK_COVER_CLOSED_RAD = 0;

/**
 * Hinge rotation (radians) of the front cover for a given open state.
 *
 * @param open - true while the Notebook is open, false when shut.
 * @returns the target rotation about the spine hinge axis: 0 when
 *   closed, {@link NOTEBOOK_COVER_OPEN_RAD} when open.
 */
export function notebookCoverRotation(open: boolean): number {
  return open ? NOTEBOOK_COVER_OPEN_RAD : NOTEBOOK_COVER_CLOSED_RAD;
}
