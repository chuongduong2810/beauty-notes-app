import { useEffect, useMemo, useRef, useState } from "react";
import { useSpring, animated } from "@react-spring/three";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, Text } from "@react-three/drei";
import { createPaperTexture } from "../lib/note-paper-texture";
import { createNotebookPageTexture } from "../lib/notebook-page-texture";
import { notebookCoverRotation } from "../lib/notebook-pose";
import {
  buildNotebookSections,
  noteSnippet,
  NOTEBOOK_SECTION_KEYS,
  NOTEBOOK_SECTION_TITLES,
  type NotebookSectionKey,
} from "../lib/notebook-sections";
import { paletteEntry } from "../lib/palette";
import { useAppStore } from "../store";
import { HoverTooltip } from "./HoverTooltip";

/**
 * Room-ownership slice of the app store, shipped by issue #70 (the
 * "claim this room" magic-link flow). Consumed read-only here — this
 * component never mutates store.ts. Declared locally as a typed view so
 * this branch compiles and is self-green before #70 merges; once #70
 * lands these exact fields exist on `AppState` and this view simply
 * mirrors them. Field/method names match the #70 contract verbatim.
 */
type OwnershipStoreSlice = {
  /** Where the magic-link claim flow currently sits. */
  claimStatus: "idle" | "sending" | "sent" | "claimed" | "error";
  /** Human-readable error from the last failed claim attempt, if any. */
  claimError: string | null;
  /** Kick off the magic-link claim for `email`. */
  claimRoom: (email: string) => Promise<void>;
  /** Reset the claim flow back to idle (e.g. "use a different email"). */
  resetClaim: () => void;
};

/**
 * Read the #70 ownership slice off the store with the contract types.
 * Until #70 merges these keys aren't on the store type, so we read
 * through an `unknown` view rather than `any` to keep it type-checked.
 *
 * @param selector - picks a value out of the ownership slice.
 * @returns the selected ownership value, reactively.
 */
function useOwnershipStore<T>(selector: (slice: OwnershipStoreSlice) => T): T {
  return useAppStore((s) => selector(s as unknown as OwnershipStoreSlice));
}

/** Local-only tab union: the three real sections plus the ownership page. */
type NotebookTabKey = NotebookSectionKey | "ownership";

/** Owner display name: the email's local part, falling back to the full
 *  address. Used on the ownership certificate. */
function ownerDisplay(email: string | null | undefined): string {
  if (!email) return "Owner";
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

/**
 * A physical Notebook resting on the desk as permanent set-dressing
 * (CONTEXT.md, ADR-0016). Built from primitive geometries only (cover
 * boxes + a page stack + a spine) so it matches the perf footprint of
 * the rest of the room furniture — no GLTF, no per-instance textures
 * beyond the one shared paper CanvasTexture.
 *
 * Interaction:
 *  - Hover  → pointer cursor + a HoverTooltip ("Notebook" / "Click to
 *    open"), exactly like the pen prop in RoomFurniture.tsx.
 *  - Click  → react-spring (ADR-0007) swings the front cover open and
 *    reveals two page planes (a left/right spread). Clicking the book
 *    again, pressing Escape, or clicking away closes it.
 *
 * Open, the spread is an *index into the current Room's existing Notes*
 * (issue #57): the left page is the three section tabs (Recently
 * Created / Recently Edited / Bookmarked); the right page lists that
 * section's Notes. Page content rides on the pages via drei
 * `<Html transform>` (ADR-0016) — the same overlay family as
 * HoverTooltip — laid flat on the paper so it reads as written-on
 * pages rather than a floating UI panel. Selecting an entry closes the
 * book and navigates the Camera to that Note via the parent's
 * `onSelectNote` (a Focus transition + a brief highlight pulse).
 *
 * Placement assumes the default Room (6 × 6 × 3 m), like the rest of
 * RoomFurniture: the desk top sits at world y≈0.77, so the closed book
 * lies flat at world [-0.45, 0.79, -2.15], clear of the pen prop at
 * [0.55, 0.772, -2.05]. If Rooms become resizable later this will need
 * to scale/move with the desk.
 */

// One shared procedural paper texture for the page sheets + open pages,
// built once at module load (no-op / null in non-DOM test envs). Same
// pattern as NoteMesh.
const PAPER_TEXTURE = createPaperTexture();
// Softer, warmer ruled texture for the open pages (the Note texture's
// near-black rules read grey at this distance).
const PAGE_PAPER_TEXTURE = createNotebookPageTexture();
/** Warm-white tint for the open page planes so the cream texture reads true. */
const OPEN_PAGE_COLOR = "#fffdf7";

const COVER_COLOR = "#7a4a2b"; // warm leather-brown cover
const SPINE_COLOR = "#653b22"; // slightly darker spine
const PAGE_COLOR = "#f4ecd8"; // cream paper edges
const GOLD = "#d9b56b"; // foil-stamped cover lettering + rules

// Self-hosted Lora WOFF (same warm serif the Notes use) for the
// foil-stamped cover title.
const COVER_FONT_URL = "/fonts/Lora-Regular.woff";

// Book footprint (metres) — about a 21 × 28 cm hardback lying flat.
const BOOK_WIDTH = 0.22; // along world +X (the open spread spans 2×)
const BOOK_DEPTH = 0.28; // along world +Z (front-to-back of the desk)
const COVER_THICKNESS = 0.012;
const PAGE_STACK_HEIGHT = 0.03;

// World pose of the (open) book on the desk (see file docstring). The
// open spread is centred on this point; the closed book sits a half-
// width to the right of it (the spine stays put as the book opens, like
// a real book), still well clear of the pen prop at x≈0.55.
const BOOK_POSITION: [number, number, number] = [-0.5, 0.79, -2.15];

/**
 * drei `<Html transform>` page-content scale. drei renders the DOM at
 * `world = px × distanceFactor / 400`, so the 184 × 240 px page DOM at
 * 0.37 maps to ~0.17 × 0.22 m — ~82% of the ~0.207 m page width and
 * ~84% of its depth, centred, so the ruled paper shows as a margin all
 * around. Tunable by eye — lower = smaller content on the page.
 */
const PAGE_HTML_DISTANCE = 0.37;

/**
 * Open "reading pose" (issue #57 follow-up). Flat on the desk the open
 * pages are viewed almost edge-on at eye-level orbit and are hard to
 * read. So on open the whole book lifts off the desk and tilts up to
 * face the viewer — as if picked up to read — then settles back flat on
 * close. Kept as a fixed tilt toward the default south-facing view
 * (rather than a camera billboard) so it still reads as a physical book.
 */
const READING_TILT_RAD = 1.0; // ~57° — pages face up-and-toward the viewer
const READING_LIFT_M = 0.22; // rises off the desk so the near edge clears it
const READING_FORWARD_M = 0.06; // eases a touch toward the viewer (+Z, south)

/** Relative "time ago" label for an ISO timestamp. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

/**
 * The open-spread page content (left tabs + right list), rendered on the
 * paper via `<Html transform>`. Kept inside Notebook so it only mounts
 * while the book is open.
 */
function NotebookSpread({
  onSelectNote,
  tab,
  setTab,
}: {
  onSelectNote: (noteId: string) => void;
  /** Active tab — lifted to Notebook so the auto-reveal effect can drive
   *  it to "ownership" when a claim completes. */
  tab: NotebookTabKey;
  setTab: (tab: NotebookTabKey) => void;
}) {
  const notes = useAppStore((s) => s.notes);
  const sections = useMemo(() => buildNotebookSections(notes), [notes]);

  // Ownership slice (#70) — read-only here.
  const session = useAppStore((s) => s.session);
  const currentRoom = useAppStore((s) => s.currentRoom);
  const claimStatus = useOwnershipStore((s) => s.claimStatus);
  const claimError = useOwnershipStore((s) => s.claimError);
  const claimRoom = useOwnershipStore((s) => s.claimRoom);
  const resetClaim = useOwnershipStore((s) => s.resetClaim);

  const isGuest = session?.user.is_anonymous ?? true;
  const ownerEmail = session?.user.email ?? null;
  const claimed = !isGuest;

  // Email typed into the claim form. Local to the open session.
  const [email, setEmail] = useState("");
  const emailValid = email.trim().length > 0 && email.includes("@");

  // The page content is DOM (drei <Html>) painted over the canvas — it
  // has no depth occlusion, so without this it bleeds through the book's
  // back cover when the user orbits behind the desk. Hide the spread
  // whenever the camera is on the far (north / -Z) side of the book so
  // from behind you just see the solid cover. Flips rarely, so we only
  // re-render on a genuine front↔back change, not every frame.
  const { camera } = useThree();
  const [front, setFront] = useState(true);
  const frontRef = useRef(true);
  useFrame(() => {
    const isFront = camera.position.z > BOOK_POSITION[2] + 0.1;
    if (isFront !== frontRef.current) {
      frontRef.current = isFront;
      setFront(isFront);
    }
  });

  // The ownership tab sits outside NOTEBOOK_SECTION_KEYS; when it's
  // active there is no section list to render. For the real sections we
  // keep the existing list/page-turn behaviour.
  const isOwnership = tab === "ownership";
  const section: NotebookSectionKey = isOwnership ? "recentlyCreated" : tab;
  const entries = sections[section];
  const sectionIndex = NOTEBOOK_SECTION_KEYS.indexOf(section);

  const turn = (dir: 1 | -1) => {
    const next =
      (sectionIndex + dir + NOTEBOOK_SECTION_KEYS.length) %
      NOTEBOOK_SECTION_KEYS.length;
    setTab(NOTEBOOK_SECTION_KEYS[next]);
  };

  const emptyMessage =
    section === "bookmarked"
      ? "Bookmark a note to keep it here."
      : "No notes yet — double-click a wall to pin one.";

  /** Submit the claim form (button click or Enter in the input). */
  const submitClaim = () => {
    if (!emailValid || claimStatus === "sending") return;
    void claimRoom(email.trim());
  };

  // Viewing from behind the book → show only the cover, not the content.
  if (!front) return null;

  return (
    <group position={[0, COVER_THICKNESS + PAGE_STACK_HEIGHT + 0.003, 0]}>
      {/* Left page — section tabs. `center` anchors the card by its
          middle at the page centre (without it the DOM top-left lands on
          the anchor and the card sits down-and-right of centre). */}
      <Html
        transform
        center
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-BOOK_WIDTH / 2, 0.001, 0]}
        distanceFactor={PAGE_HTML_DISTANCE}
        zIndexRange={[60, 0]}
        pointerEvents="auto"
      >
        <div className="notebook-page notebook-page--left">
          <div className="notebook-page__brand">Notebook</div>
          <div className="notebook-tabs">
            {NOTEBOOK_SECTION_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={
                  "notebook-tab" + (key === tab ? " notebook-tab--active" : "")
                }
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setTab(key)}
              >
                {NOTEBOOK_SECTION_TITLES[key]}
                <span className="notebook-tab__count">
                  {sections[key].length}
                </span>
              </button>
            ))}
            {/* Fourth, special tab — the room-ownership page. Outside
                NOTEBOOK_SECTION_KEYS; styled as a gold "stamp" so it
                reads as the book's deed page. */}
            <button
              type="button"
              className={
                "notebook-tab notebook-tab--ownership" +
                (isOwnership ? " notebook-tab--active" : "")
              }
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setTab("ownership")}
            >
              {claimed ? "Ownership" : "Claim this room"}
              <span className="notebook-tab__seal" aria-hidden="true">
                ✦
              </span>
            </button>
          </div>
        </div>
      </Html>

      {/* Right page — the current section's Notes. Keyed by section so
          switching tabs remounts the list and replays the page-turn
          flip animation (CSS in index.html). */}
      <Html
        transform
        center
        rotation={[-Math.PI / 2, 0, 0]}
        position={[BOOK_WIDTH / 2, 0.001, 0]}
        distanceFactor={PAGE_HTML_DISTANCE}
        zIndexRange={[60, 0]}
        pointerEvents="auto"
      >
        <div className="notebook-page notebook-page--right">
          {isOwnership ? (
            <OwnershipPage
              claimed={claimed}
              claimStatus={claimStatus}
              claimError={claimError}
              email={email}
              setEmail={setEmail}
              emailValid={emailValid}
              submitClaim={submitClaim}
              resetClaim={resetClaim}
              ownerEmail={ownerEmail}
              roomName={currentRoom?.name ?? "this room"}
            />
          ) : (
            <>
          <div className="notebook-page__title">
            {NOTEBOOK_SECTION_TITLES[section]}
          </div>
          <div key={section} className="notebook-list notebook-list--flip">
            {entries.length === 0 ? (
              <div className="notebook-empty">{emptyMessage}</div>
            ) : (
              entries.map((n) => {
                const pal = paletteEntry(n.color_id);
                return (
                  <button
                    key={n.id}
                    type="button"
                    className="notebook-entry"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onSelectNote(n.id)}
                  >
                    <span
                      className="notebook-entry__swatch"
                      style={{ background: pal.base }}
                    />
                    <span className="notebook-entry__text">
                      {noteSnippet(n.body)}
                    </span>
                    <span className="notebook-entry__time">
                      {timeAgo(n.updated_at)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {/* Page-turn affordance between sections. */}
          <div className="notebook-pageturn">
            <button
              type="button"
              className="notebook-pageturn__btn"
              aria-label="Previous section"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => turn(-1)}
            >
              ‹
            </button>
            <span className="notebook-pageturn__dots">
              {NOTEBOOK_SECTION_KEYS.map((key, i) => (
                <span
                  key={key}
                  className={
                    "notebook-pageturn__dot" +
                    (i === sectionIndex ? " notebook-pageturn__dot--on" : "")
                  }
                />
              ))}
            </span>
            <button
              type="button"
              className="notebook-pageturn__btn"
              aria-label="Next section"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => turn(1)}
            >
              ›
            </button>
          </div>
            </>
          )}
        </div>
      </Html>
    </group>
  );
}

/**
 * Right-page ownership content (issue #71). Branches on the #70 claim
 * state machine: Claim form → "check your email" → ownership
 * certificate. Rendered inside the same `<Html transform>` page as the
 * note-index, so it reads as another printed page rather than a floating
 * form. Pointer-down handlers stop propagation so typing/clicking inside
 * the page never toggles or closes the book.
 */
function OwnershipPage({
  claimed,
  claimStatus,
  claimError,
  email,
  setEmail,
  emailValid,
  submitClaim,
  resetClaim,
  ownerEmail,
  roomName,
}: {
  claimed: boolean;
  claimStatus: OwnershipStoreSlice["claimStatus"];
  claimError: string | null;
  email: string;
  setEmail: (email: string) => void;
  emailValid: boolean;
  submitClaim: () => void;
  resetClaim: () => void;
  ownerEmail: string | null;
  roomName: string;
}) {
  // Claimed — the cozy certificate.
  if (claimed) {
    return (
      <div className="notebook-list--flip">
        <div className="notebook-cert">
          <div className="notebook-cert__seal" aria-hidden="true">
            ✦
          </div>
          <div className="notebook-cert__kicker">Certificate of</div>
          <div className="notebook-cert__title">Ownership</div>
          <div className="notebook-cert__rule" />
          <dl className="notebook-cert__fields">
            <dt>Owner</dt>
            <dd>{ownerDisplay(ownerEmail)}</dd>
            <dt>Room</dt>
            <dd>{roomName}</dd>
          </dl>
          <div className="notebook-cert__status">Owned</div>
        </div>
      </div>
    );
  }

  // Magic link sent — "check your email".
  if (claimStatus === "sent") {
    return (
      <div className="notebook-list--flip">
        <div className="notebook-page__title">Check your email</div>
        <p className="notebook-claim__copy">
          We sent a magic link to{" "}
          <span className="notebook-claim__email">{email || "your inbox"}</span>{" "}
          — open it to claim this room.
        </p>
        <button
          type="button"
          className="notebook-claim__alt"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => resetClaim()}
        >
          use a different email
        </button>
      </div>
    );
  }

  // Guest, idle or error — the claim form.
  const sending = claimStatus === "sending";
  return (
    <div className="notebook-list--flip">
      <div className="notebook-page__title">Claim This Room</div>
      <p className="notebook-claim__copy">
        Sign your name to this room to keep it — we&apos;ll email you a magic
        link.
      </p>
      <input
        type="email"
        className="notebook-claim__input"
        placeholder="you@example.com"
        value={email}
        autoComplete="email"
        spellCheck={false}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submitClaim();
        }}
      />
      {claimStatus === "error" && claimError && (
        <div className="notebook-claim__error">{claimError}</div>
      )}
      <button
        type="button"
        className="notebook-claim__cta"
        disabled={!emailValid || sending}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => submitClaim()}
      >
        {sending ? "Signing…" : "Sign & Claim"}
      </button>
    </div>
  );
}

export function Notebook({
  onSelectNote,
}: {
  /** Navigate the Camera to a Note picked from the Notebook — snapshots
   *  the orbit pose and runs a Focus transition + highlight (issue #57).
   *  Owned by App.tsx so the camera-pose math isn't duplicated. */
  onSelectNote: (noteId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  // Active spread tab. Lifted here (not inside NotebookSpread) so the
  // auto-reveal effect can turn to the ownership page on a completed
  // claim even while the book is shut.
  const [tab, setTab] = useState<NotebookTabKey>("recentlyCreated");

  // Auto-reveal on claim success (#71): when the room becomes claimed,
  // open the book and turn to the ownership certificate.
  const claimStatus = useOwnershipStore((s) => s.claimStatus);
  useEffect(() => {
    if (claimStatus === "claimed") {
      setOpen(true);
      setTab("ownership");
    }
  }, [claimStatus]);

  // Escape closes the open book — mirrors the focus/editor escape
  // affordances elsewhere in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // react-spring drives the cover hinge angle. A gentle wobble settle
  // (low tension / moderate friction) so the cover swings open and
  // eases to rest rather than snapping.
  const { coverAngle, tilt, riseY, forwardZ } = useSpring({
    coverAngle: notebookCoverRotation(open),
    // Lift + tilt the whole book up to face the viewer while open so the
    // pages are readable, not viewed edge-on flat on the desk.
    tilt: open ? READING_TILT_RAD : 0,
    riseY: open ? READING_LIFT_M : 0,
    forwardZ: open ? READING_FORWARD_M : 0,
    config: { tension: 120, friction: 18 },
  });

  const onOver = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  };
  const onOut = () => {
    setHovered(false);
    document.body.style.cursor = "";
  };
  const onClickBook = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setOpen((o) => !o);
  };

  // Selecting a Note closes the book, then navigates to it. Close first
  // so the camera flight isn't framed through the open spread.
  const handleSelect = (noteId: string) => {
    setOpen(false);
    onSelectNote(noteId);
  };

  // The spine sits at the book's centre (x=0) — like a real open book,
  // the binding is in the middle. The book body (back cover + page
  // stack + closed front cover) lives in the RIGHT half (centred at
  // +HALF); opening swings the front cover about the centre spine into
  // the LEFT half (centred at -HALF), so the two pages at ±HALF end up
  // symmetric about the spine and centred on the book.
  const HALF = BOOK_WIDTH / 2;
  const coverTopY = PAGE_STACK_HEIGHT / 2 + COVER_THICKNESS / 2;

  return (
    <>
      {/* Invisible click-away catcher: a large plane just above the
          desk that closes the book when the user clicks empty space.
          Only mounted while open so it never blocks other props. */}
      {open && (
        <mesh
          position={[BOOK_POSITION[0], BOOK_POSITION[1] + 0.001, BOOK_POSITION[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <planeGeometry args={[6, 6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      <animated.group
        position-x={BOOK_POSITION[0]}
        position-y={riseY.to((y) => BOOK_POSITION[1] + y)}
        position-z={forwardZ.to((z) => BOOK_POSITION[2] + z)}
        // Tilt the near (front, +Z) edge down / far edge up so the open
        // pages face up-and-toward the viewer (see READING_TILT_RAD).
        rotation-x={tilt}
      >
        {/* Hover handlers wrap the whole book so they fire on any of
            its primitive meshes (same shape as the pen block). */}
        <group
          onPointerOver={onOver}
          onPointerOut={onOut}
          onPointerDown={onClickBook}
        >
          {/* Back cover — the right half of the open book; under the
              right page. */}
          <mesh castShadow receiveShadow position={[HALF, COVER_THICKNESS / 2, 0]}>
            <boxGeometry args={[BOOK_WIDTH, COVER_THICKNESS, BOOK_DEPTH]} />
            <meshStandardMaterial color={COVER_COLOR} roughness={0.7} metalness={0.05} />
          </mesh>

          {/* Page stack — cream block of sheets sitting on the back
              cover (right half). */}
          <mesh
            castShadow
            receiveShadow
            position={[HALF, COVER_THICKNESS + PAGE_STACK_HEIGHT / 2, 0]}
          >
            <boxGeometry
              args={[BOOK_WIDTH * 0.96, PAGE_STACK_HEIGHT, BOOK_DEPTH * 0.96]}
            />
            <meshStandardMaterial
              color={PAGE_COLOR}
              map={PAPER_TEXTURE ?? undefined}
              roughness={0.95}
              metalness={0}
            />
          </mesh>

          {/* Spine — the central binding (x=0) the front cover hinges
              about. */}
          <mesh
            castShadow
            receiveShadow
            position={[0, COVER_THICKNESS + PAGE_STACK_HEIGHT / 2, 0]}
          >
            <boxGeometry
              args={[COVER_THICKNESS, PAGE_STACK_HEIGHT + COVER_THICKNESS * 2, BOOK_DEPTH]}
            />
            <meshStandardMaterial color={SPINE_COLOR} roughness={0.7} metalness={0.05} />
          </mesh>

          {/* Front cover — hinged at the centre spine (x=0). Closed it
              lies on the page stack (right half); react-spring rotates it
              a full 180° about the spine into the left half, where it
              backs the left page. Pivoted at the spine so the swing is
              about the binding, not the cover's centre. */}
          <animated.group
            position={[0, COVER_THICKNESS + PAGE_STACK_HEIGHT, 0]}
            rotation-z={coverAngle}
          >
            <mesh
              castShadow
              receiveShadow
              position={[HALF, coverTopY, 0]}
            >
              <boxGeometry args={[BOOK_WIDTH, COVER_THICKNESS, BOOK_DEPTH]} />
              <meshStandardMaterial color={COVER_COLOR} roughness={0.7} metalness={0.05} />
            </mesh>

            {/* Foil-stamped title on the cover face. Sits a hair above
                the cover's top surface; rotated flat so it reads when the
                book is closed. Flips under with the cover when opened. */}
            <group
              position={[HALF, coverTopY + COVER_THICKNESS / 2 + 0.0012, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              {/* Decorative gold rules above + below the title. */}
              <mesh position={[0, 0.052, 0]}>
                <planeGeometry args={[0.14, 0.0025]} />
                <meshStandardMaterial color={GOLD} roughness={0.4} metalness={0.5} />
              </mesh>
              <mesh position={[0, -0.012, 0]}>
                <planeGeometry args={[0.14, 0.0025]} />
                <meshStandardMaterial color={GOLD} roughness={0.4} metalness={0.5} />
              </mesh>
              <Text
                font={COVER_FONT_URL}
                position={[0, 0.022, 0.0005]}
                fontSize={0.024}
                letterSpacing={0.12}
                color={GOLD}
                anchorX="center"
                anchorY="middle"
              >
                NOTEBOOK
              </Text>
              <Text
                font={COVER_FONT_URL}
                position={[0, -0.05, 0.0005]}
                fontSize={0.0095}
                letterSpacing={0.18}
                color={GOLD}
                anchorX="center"
                anchorY="middle"
              >
                · thoughts &amp; notes ·
              </Text>
            </group>
          </animated.group>
        </group>

        {/* Open spread — two page planes + the index content (issue #57).
            Only mounted while open. The planes face up (rotated flat)
            just above the page stack; the left page lies where the
            swung-open front cover now sits, the right page over the
            stack itself. */}
        {open && (
          <group position={[0, COVER_THICKNESS + PAGE_STACK_HEIGHT + 0.002, 0]}>
            {/* Left page (under the opened cover, world -X half). */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-BOOK_WIDTH / 2, 0, 0]}>
              <planeGeometry args={[BOOK_WIDTH * 0.94, BOOK_DEPTH * 0.94]} />
              <meshStandardMaterial
                color={OPEN_PAGE_COLOR}
                map={PAGE_PAPER_TEXTURE ?? undefined}
                roughness={0.95}
                metalness={0}
              />
            </mesh>
            {/* Right page (over the stack, world +X half). */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[BOOK_WIDTH / 2, 0, 0]}>
              <planeGeometry args={[BOOK_WIDTH * 0.94, BOOK_DEPTH * 0.94]} />
              <meshStandardMaterial
                color={OPEN_PAGE_COLOR}
                map={PAGE_PAPER_TEXTURE ?? undefined}
                roughness={0.95}
                metalness={0}
              />
            </mesh>
          </group>
        )}

        {/* The page index content rides on the open spread via
            <Html transform> (ADR-0016). Mounted separately so its own
            section state is scoped to one open session. */}
        {open && (
          <NotebookSpread
            onSelectNote={handleSelect}
            tab={tab}
            setTab={setTab}
          />
        )}

        {/* Hover toast above the book — same futuristic HUD card as the
            pen prop. */}
        <HoverTooltip
          visible={hovered && !open}
          title="Notebook"
          subtitle="Click to open"
          position={[0, 0.12, 0]}
        />
      </animated.group>
    </>
  );
}
