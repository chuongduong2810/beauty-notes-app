# Falling rain is rendered by three.quarks; ambient sound is the one user-toggled facet of Weather

The falling rain outside the Window (ADR-0015, issue #43) was a hand-rolled
`lineSegments` cloud: 2,200 drops stepped manually each frame, all falling
dead-straight down at one streak length. In practice it read as a flat,
"static and ugly" curtain — no wind, no depth, no size or speed variety, no
splash. At the same time the Room had **no sound at all**, so the always-rainy
mood was carried entirely by visuals.

This requirement does two things, both recorded here because each is a
hard-to-reverse, surprising trade-off touching the **Weather** glossary term:

1. **Replace the falling-rain renderer with the `three.quarks` GPU particle
   engine.**
2. **Add an ambient soundscape that is the single User-controllable facet of
   the otherwise-fixed Weather** — off by default, a small in-room control, a
   three-track selector, session-only.

## Decision 1 — falling rain uses three.quarks

The falling-rain layer (`CityRain`) is reimplemented on top of `three.quarks`
(`BatchedRenderer` + a `ParticleSystem`), mounted exactly where it was: inside
the City `RenderTexture` sub-scene in `CityView`, so it still reads *through*
the glass and never enters the Room interior. The richer look — varied drop
size/length, depth fade, a steady wind drift, faster near drops than far —
comes from the engine's per-particle over-life curves rather than bespoke
math.

### Considered options

- **Keep hand-rolling, just add variety** — wind, size/speed spread, splash
  flecks in the existing `lineSegments` stepper. Zero new dependency. Rejected:
  the requirement explicitly asks for `three.quarks`, and reproducing a tuned
  particle engine (over-life size/color/velocity curves, batched draw) by hand
  is more code to own than the library it imitates.
- **A different particle lib (e.g. `three-nebula`)** — rejected: not asked for,
  and `three.quarks` is the named, actively-maintained choice with first-class
  TypeScript types and a `three@0.169`-compatible release.
- **three.quarks (chosen)** — purpose-built, typed, batched. The cost is a new
  runtime dependency and giving up frame-for-frame determinism on this layer
  (see consequences).

### Consequences

- **Determinism is relaxed for the falling-rain layer only.** The old
  `rain-field.ts` was deterministic (seeded mulberry32) so the field was
  "identical across renders/reloads." `three.quarks` owns emission and uses its
  own RNG, so this layer is no longer reproducible frame-for-frame. This is
  invisible for a continuous ambient downpour and is an accepted trade. The
  **on-glass rain streaks** (`rain-streaks.ts`, issue #44) are a separate layer
  and stay deterministic and unchanged.
- **`rain-field.ts` is trimmed, not deleted wholesale.** Its `RAIN_BOUNDS(width)`
  — the tested "slab beyond the west wall" geometry that guarantees no drop ever
  enters the Room — is **kept and reused** as the particle emitter's volume, so
  the ADR-0015 containment invariant stays test-covered. The now-unused
  per-drop helpers (`createRainField`, `stepRaindrop`) and their tests are
  removed as orphaned by the swap.
- **`CityRain`'s public shape is unchanged** (`<CityRain roomWidthM={…} />`), so
  `CityView` is untouched and the swap is contained to the rain layer.
- A new runtime dependency (`three.quarks`) is added; it must be pinned to a
  release compatible with the project's `three@0.169`.

## Decision 2 — ambient soundscape is a user-toggled layer of Weather

Weather has been "a fixed atmosphere, not user-configurable" (ADR-0015). We now
carve out **one** User-controllable facet: an **ambient soundscape**. Everything
about its framing keeps it a Weather layer, not a settings screen.

- **Off by default.** The Room opens silent. The User starts sound from a small
  in-room speaker control. This both respects "calm by default" and sidesteps
  the browser autoplay policy: playback only begins from a real user gesture, so
  it can never be blocked.
- **A three-track selector**, served from `public/audio/`: `forest.mp3`,
  `music1.mp3`, and `soundreality-ambient-old-house-496466.mp3`. The User picks
  one; it loops at a low ambient volume.
- **Session-only, not persisted.** Like the rest of Weather (ADR-0015), the
  on/off state and chosen track are **not** stored per Room — no schema, no
  migration. A reload opens silent again. This keeps Weather firmly distinct
  from the persisted **Ambience** Customization layer (ADR-0022).

### Considered options

- **Autoplay on Room open** — rejected: browsers block un-gestured audio, and
  an unsolicited loop is a hostile default for a note-taking app.
- **Persist the choice per Room (a new column)** — rejected: Weather is
  deliberately non-persistent (ADR-0015); persisting sound would blur the
  Weather/Ambience boundary and add a migration for a cosmetic session toggle.
- **Make sound part of the premium Ambience Catalog** — rejected for this
  slice: Ambience is a paid, persisted Customization (ADR-0022); the baseline
  rainy Weather should have a free, simple soundscape. A premium Ambience track
  layer can come later without contradicting this.
- **Session-only, gesture-started, off by default (chosen)** — least
  surprising, no schema, no autoplay fight, and keeps the Weather/Ambience line
  clean.

### Consequences

- A new chrome control joins the existing in-room chrome (ToolPalette,
  CustomizationPanel, RoomPicker). It never gates note-taking.
- The three `public/audio/*.mp3` assets are committed to the repo so they ship
  with the build (they were previously untracked).
- Because the state is session-only, it lives in the Zustand store (not the
  Room row) and resets on reload — matching Weather's non-persistence.
