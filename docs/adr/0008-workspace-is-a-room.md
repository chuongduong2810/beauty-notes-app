# Workspace is a Room with Six Surfaces

A workspace is a bounded 3D **Room** — 6 m × 6 m × 3 m by default — with exactly six **Surfaces**: four walls, a floor, and a ceiling. Notes Pin to a Surface at a normalized `(u, v) ∈ [0, 1]²`; they never float in free 3D. This supersedes ADR-0004 (Canvas as a 50 000 × 50 000 X/Y volume with Camera dolly).

The product brief shifted from "flat infinite canvas with parallax depth" to "physically inside an immersive room with notes on walls". A literal 3D plane with a free camera would technically meet that wording but breaks the user's mental model — "I'm in a room" requires architecture you can see in every direction, not an unbounded plane disappearing into fog. A bounded Room gives the Camera something real to look at, gives Notes an obvious attachment story, and lets us specify lighting and paper effects in human units (centimetres, metres).

The Room is deliberately **fixed-geometry** in v2: users cannot add, move, or remove Surfaces. Variable rooms would force every Note's coordinates to be relative to a Surface that itself moves, ballooning both the data model and the placement UI for no v2 brief requirement. Six fixed Surfaces also let us pre-bake lighting, shadow maps, and atmosphere once per Room.

The accepted cost is that v1's "infinite-feeling" plane disappears — a Room is small and bounded. Users who outgrow one Room create another (multi-Room is preserved from v1's multi-Canvas).
