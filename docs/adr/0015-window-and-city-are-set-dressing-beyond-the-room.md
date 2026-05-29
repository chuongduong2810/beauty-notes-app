# Window and City are set-dressing beyond the Room boundary, not Surfaces

A Room is defined as exactly six Surfaces (ADR-0008), so a window prompted the question of whether it should be a seventh Surface, a persisted entity, or a cut-out region of a wall. We decided the **Window is fixed set-dressing rendered in front of a wall Surface** (like the desk and lamp in `RoomFurniture`), and the **City is a backdrop that lives outside the Room boundary** — neither is a Surface, neither is persisted, and the six-Surface model is untouched.

## Considered Options

- **First-class Window entity** — a persisted, glossary-level concept occupying a (u,v) region of a wall where Notes can't be Pinned. Rejected: adds a schema/migration, a new glossary noun, and "can a Note overlap a Window" exclusion rules, for a feature that is purely atmospheric.
- **Redefine Surface to include a transparent cut-out** — changes the meaning of Surface and touches `surface-geometry`, raycasting, `note-placement`, and the pen hit-tests. Rejected: most invasive, for no functional gain.
- **Set-dressing (chosen)** — zero schema change, no glossary churn to the core nouns, and it reuses the established "primitive-only decoration in front of a Surface" pattern.

## Consequences

- Notes and Annotations *can* be Pinned over the glass, because the wall Surface beneath the Window is whole. Accepted as fine for v2 ("a note stuck to the window"); a (u,v) exclusion can be added later if it ever looks wrong.
- The Window is hard-coded to the default 6×6×3 m Room (like the furniture). If Rooms ever become resizable, the Window and City placement must scale with `room.width_m / depth_m / height_m`.
- Weather (rain + overcast light) is ambient and non-persistent. Interior light reacts via constants in the existing pure `atmosphere-config.ts`, keeping the decision logic testable.
