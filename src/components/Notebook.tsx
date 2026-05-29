import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
import { buildRoomLedger } from "../lib/room-ledger";
import { paletteEntry } from "../lib/palette";
import { useAppStore } from "../store";
import { HoverTooltip } from "./HoverTooltip";

/**
 * Room-ownership slice of the app store (issue #70 — the "claim this
 * room" magic-link flow). Consumed read-only here; this component never
 * mutates store.ts. Field/method names match the #70 contract verbatim.
 */
type OwnershipStoreSlice = {
  claimStatus: "idle" | "sending" | "sent" | "claimed" | "error";
  claimError: string | null;
  claimRoom: (email: string) => Promise<void>;
  resetClaim: () => void;
};

/** Read the ownership slice off the store with the contract types. */
function useOwnershipStore<T>(selector: (slice: OwnershipStoreSlice) => T): T {
  return useAppStore((s) => selector(s as unknown as OwnershipStoreSlice));
}

/**
 * Which spread the open Notebook is showing (redesign per the 4-stage
 * ownership flow). The three Note sections + the Room Ledger are "browse"
 * spreads (tabs on the left page); `claim` and `certificate` are
 * full-spread takeovers for the ownership flow.
 */
type NotebookView =
  | NotebookSectionKey
  | "ledger"
  | "claim"
  | "certificate";

const BROWSE_VIEWS = new Set<NotebookView>([
  ...NOTEBOOK_SECTION_KEYS,
  "ledger",
]);

/** Order the ‹ / › page-turn cycles through in browse mode — the three
 *  Note sections then the Room Ledger, so there's always a next/prev. */
const BROWSE_ORDER: NotebookView[] = [...NOTEBOOK_SECTION_KEYS, "ledger"];

/** Small glyphs for the left-page tabs. */
const SECTION_ICON: Record<NotebookSectionKey, string> = {
  recentlyCreated: "🗒",
  recentlyEdited: "✎",
  bookmarked: "🔖",
};

/** Owner display name: the email's local part, falling back sensibly. */
function ownerDisplay(email: string | null | undefined): string {
  if (!email) return "Owner";
  const at = email.indexOf("@");
  const local = at > 0 ? email.slice(0, at) : email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/**
 * A physical Notebook resting on the desk as permanent set-dressing
 * (CONTEXT.md, ADR-0016). Primitive geometry only (cover boxes + page
 * stack + spine). Opening swings the front cover and reveals a two-page
 * spread whose content rides on the paper via drei `<Html transform>`.
 *
 * The open spread has two faces:
 *  - **Browse** — the left page is tabs (Recently Created / Edited /
 *    Bookmarked, then the Room Ledger, then a locked Ownership
 *    Certificate); the right page shows the chosen tab.
 *  - **Ownership flow** — a full-spread takeover for claiming the Room
 *    (ADR-0018): Claim This Room → Letter Sent → Ownership Certificate,
 *    with a page-turn between each stage.
 *
 * Placement assumes the default Room (6 × 6 × 3 m); the closed book lies
 * at world [-0.5, 0.79, -2.15], clear of the pen prop.
 */

const PAPER_TEXTURE = createPaperTexture();
const PAGE_PAPER_TEXTURE = createNotebookPageTexture();
const OPEN_PAGE_COLOR = "#fffdf7";

const COVER_COLOR = "#7a4a2b";
const SPINE_COLOR = "#653b22";
const PAGE_COLOR = "#f4ecd8";
const GOLD = "#d9b56b";

const COVER_FONT_URL = "/fonts/Lora-Regular.woff";

const BOOK_WIDTH = 0.22;
const BOOK_DEPTH = 0.28;
const COVER_THICKNESS = 0.012;
const PAGE_STACK_HEIGHT = 0.03;

const BOOK_POSITION: [number, number, number] = [-0.5, 0.79, -2.15];

const PAGE_HTML_DISTANCE = 0.37;

const READING_TILT_RAD = 1.0;
const READING_LIFT_M = 0.22;
const READING_FORWARD_M = 0.06;

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

/** Long-form date for the ownership certificate ("May 24, 2026"). */
function certDate(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * The open-spread page content, rendered on the paper via two
 * `<Html transform>` pages (left + right). Branches across the redesign's
 * views: browse (tabs + section/ledger) and the full-spread ownership
 * flow (claim → letter sent → certificate). Each view change replays a
 * page-turn animation via a `turnKey` that re-mounts both pages.
 */
function NotebookSpread({
  onSelectNote,
  view,
  setView,
  onClose,
}: {
  onSelectNote: (noteId: string) => void;
  view: NotebookView;
  setView: (view: NotebookView) => void;
  /** Close the book back to the room ("Back to Room"). */
  onClose: () => void;
}) {
  const notes = useAppStore((s) => s.notes);
  const sections = useMemo(() => buildNotebookSections(notes), [notes]);

  const session = useAppStore((s) => s.session);
  const currentRoom = useAppStore((s) => s.currentRoom);
  const setNotebookDragging = useAppStore((s) => s.setNotebookDragging);
  const claimStatus = useOwnershipStore((s) => s.claimStatus);
  const claimError = useOwnershipStore((s) => s.claimError);
  const claimRoom = useOwnershipStore((s) => s.claimRoom);
  const resetClaim = useOwnershipStore((s) => s.resetClaim);

  const isGuest = session?.user.is_anonymous ?? true;
  const claimed = !isGuest;
  const ownerEmail = session?.user.email ?? null;
  const roomName = currentRoom?.name?.trim() || "Your Thinking Room";

  const ledger = useMemo(
    () => buildRoomLedger(notes, currentRoom, claimed, Date.now()),
    [notes, currentRoom, claimed],
  );

  const [email, setEmail] = useState("");
  const emailValid = email.trim().length > 0 && email.includes("@");

  // Hide the DOM content when the camera is behind the book (the <Html>
  // overlay has no depth occlusion). Flips rarely → only re-render on the
  // genuine front↔back change.
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

  const isBrowse = BROWSE_VIEWS.has(view);
  const section: NotebookSectionKey = NOTEBOOK_SECTION_KEYS.includes(
    view as NotebookSectionKey,
  )
    ? (view as NotebookSectionKey)
    : "recentlyCreated";
  // Browse pager — cycles all browse pages (sections + Room Ledger).
  const browseIndex = BROWSE_ORDER.indexOf(view);
  const turnBrowse = (dir: 1 | -1) => {
    const next = (browseIndex + dir + BROWSE_ORDER.length) % BROWSE_ORDER.length;
    setView(BROWSE_ORDER[next]);
  };

  // What a page-turn does from the current view: in browse it cycles the
  // pages; on the full-spread ownership pages it turns back to the ledger.
  const commitTurn = (dir: 1 | -1) => {
    if (isBrowse) turnBrowse(dir);
    else setView("ledger");
  };

  // Drag-to-turn (no arrow buttons — matches the tactile book vibe). A
  // horizontal drag past the threshold flips the page (drag left → next,
  // drag right → previous); a small movement falls through as a click on
  // whatever's underneath (guarded by `didDragRef`). The grabbed page
  // follows the drag a little for feedback, then the new page animates in.
  const DRAG_TURN_PX = 32;
  const dragRef = useRef({ startX: 0, startY: 0, pointerId: -1, dragging: false });
  const didDragRef = useRef(false);
  const [dragX, setDragX] = useState(0);
  const onPageDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
      dragging: false,
    };
    didDragRef.current = false;
  };
  const onPageMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      d.dragging = true;
      didDragRef.current = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setNotebookDragging(true); // lock the orbit camera for the turn
    }
    if (d.dragging) setDragX(dx);
  };
  const onPageUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const wasDragging = d.dragging;
    d.pointerId = -1;
    d.dragging = false;
    setDragX(0);
    if (wasDragging) setNotebookDragging(false);
    if (wasDragging && Math.abs(dx) > DRAG_TURN_PX) commitTurn(dx < 0 ? 1 : -1);
  };
  // Safety: if the book closes mid-drag (this spread unmounts), make sure
  // the orbit camera isn't left locked.
  useEffect(() => () => setNotebookDragging(false), [setNotebookDragging]);

  const clamp = (x: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, x));
  const pageStyle = dragX
    ? {
        transform: `perspective(900px) translateX(${clamp(dragX * 0.35, -30, 30)}px) rotateY(${clamp(dragX * 0.05, -12, 12)}deg)`,
        animation: "none" as const,
      }
    : undefined;
  const pageHandlers = {
    onPointerDown: onPageDown,
    onPointerMove: onPageMove,
    onPointerUp: onPageUp,
    onPointerCancel: onPageUp,
  };

  const submitClaim = () => {
    if (!emailValid || claimStatus === "sending") return;
    void claimRoom(email.trim());
  };

  const backToRoom = () => {
    resetClaim();
    onClose();
  };

  // Re-mounts both pages on any view/stage change so the page-turn
  // animation replays.
  const turnKey = `${view}:${claimStatus}`;

  if (!front) return null;

  // ── Build the left + right page bodies for the active view ──────────
  let leftBody: React.ReactNode;
  let rightBody: React.ReactNode;

  if (isBrowse) {
    leftBody = (
      <>
        <div className="notebook-page__brand">Notebook</div>
        <div className="notebook-tabs">
          {NOTEBOOK_SECTION_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={
                "notebook-tab" + (key === view ? " notebook-tab--active" : "")
              }
              onClick={() => {
                if (didDragRef.current) return;
                setView(key);
              }}
            >
              <span className="nb-tab__icon" aria-hidden="true">
                {SECTION_ICON[key]}
              </span>
              <span className="nb-tab__label">{NOTEBOOK_SECTION_TITLES[key]}</span>
              <span className="notebook-tab__count">{sections[key].length}</span>
            </button>
          ))}
          <div className="notebook-tabs__divider" />
          <button
            type="button"
            className={
              "notebook-tab" + (view === "ledger" ? " notebook-tab--active" : "")
            }
            onClick={() => {
              if (didDragRef.current) return;
              setView("ledger");
            }}
          >
            <span className="nb-tab__icon" aria-hidden="true">📋</span>
            <span className="nb-tab__label">Room Ledger</span>
          </button>
          <button
            type="button"
            className={
              "notebook-tab notebook-tab--deed" +
              (claimed ? "" : " notebook-tab--locked")
            }
            onClick={() => {
              if (didDragRef.current) return;
              if (claimed) setView("certificate");
            }}
          >
            <span className="nb-tab__icon" aria-hidden="true">
              {claimed ? "🏅" : "🔒"}
            </span>
            <span className="nb-tab__label">Ownership Certificate</span>
          </button>
        </div>
      </>
    );

    if (view === "ledger") {
      rightBody = (
        <>
          <div className="notebook-page__title">Room Ledger</div>
          <div className="nb-ledger">
            <div className="nb-ledger__name">{roomName}</div>
            <div className="nb-ledger__sub">
              {claimed
                ? "Your room for ideas, sketches, and memories."
                : "An unclaimed room for ideas, sketches, and memories."}
            </div>
            <dl className="nb-ledger__stats">
              <dt>Status</dt>
              <dd className="nb-ledger__statusval">
                <span
                  className={
                    "nb-ledger__dot" +
                    (claimed ? " nb-ledger__dot--owned" : "")
                  }
                />
                {ledger.status}
              </dd>
              <dt>Notes</dt>
              <dd>{ledger.noteCount}</dd>
              <dt>Bookmarks</dt>
              <dd>{ledger.bookmarkCount}</dd>
              <dt>Created</dt>
              <dd>{ledger.createdLabel}</dd>
            </dl>
            <div className="nb-ledger__recent-h">Recent Notes</div>
            <div className="nb-ledger__recent">
              {ledger.recentNotes.length === 0 ? (
                <div className="notebook-empty">No notes yet.</div>
              ) : (
                ledger.recentNotes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="nb-ledger__row"
                    onClick={() => {
                      if (didDragRef.current) return;
                      onSelectNote(n.id);
                    }}
                  >
                    <span className="nb-ledger__check" aria-hidden="true">☐</span>
                    <span className="nb-ledger__rowtext">{noteSnippet(n.body)}</span>
                    <span className="nb-ledger__rowtime">{timeAgo(n.updated_at)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
          {claimed ? (
            <button
              type="button"
              className="nb-ledger__claim nb-ledger__claim--view"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setView("certificate")}
            >
              View Certificate <span aria-hidden="true">→</span>
            </button>
          ) : (
            <button
              type="button"
              className="nb-ledger__claim"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setView("claim")}
            >
              Claim This Room <span aria-hidden="true">→</span>
            </button>
          )}
        </>
      );
    } else {
      const entries = sections[section];
      const emptyMessage =
        section === "bookmarked"
          ? "Bookmark a note to keep it here."
          : "No notes yet — double-click a wall to pin one.";
      rightBody = (
        <>
          <div className="notebook-page__title">
            {NOTEBOOK_SECTION_TITLES[section]}
          </div>
          <div className="notebook-list">
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
                    onClick={() => {
                      if (didDragRef.current) return;
                      onSelectNote(n.id);
                    }}
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
        </>
      );
    }
  } else if (view === "certificate") {
    // ── Stage 4: Ownership Certificate (full spread) ──────────────────
    leftBody = (
      <div className="nb-cert-left">
        <div className="nb-cert-left__frame">
          <div className="nb-cert-left__kicker">Certificate of</div>
          <div className="nb-cert-left__title">Ownership</div>
          <span className="nb-cert-left__door" aria-hidden="true">🚪</span>
          <p className="nb-cert-left__note">
            This room is yours.
            <br />
            Take care of it.
          </p>
          <span className="nb-cert-left__seal" aria-hidden="true">🌳</span>
        </div>
      </div>
    );
    rightBody = (
      <>
        <div className="notebook-page__title">Ownership Certificate</div>
        <p className="nb-cert__line">This certifies that</p>
        <p className="nb-cert__name">{ownerDisplay(ownerEmail)}</p>
        <p className="nb-cert__line">is the rightful owner of</p>
        <p className="nb-cert__room">{roomName}</p>
        <p className="nb-cert__claimed">
          Claimed on{" "}
          <span>{certDate(session?.user.email_confirmed_at)}</span>
        </p>
        <div className="nb-cert__statusrow">
          <span className="nb-cert__dot" /> Owned
        </div>
        <div className="nb-cert__stamp" aria-hidden="true">
          Ownership<br />Verified
        </div>
        <p className="nb-cert__sig">Your thoughts. Your space. Forever yours.</p>
      </>
    );
  } else {
    // ── Claim flow (full spread): stage 2 form, or stage 3 letter sent ─
    const sent = claimStatus === "sent" || claimStatus === "sending";
    if (sent) {
      leftBody = (
        <div className="nb-claim-left nb-sent-left">
          <p className="nb-sent-left__title">
            Sending
            <br />
            your letter…
          </p>
          <span className="nb-sent-left__env" aria-hidden="true">✉️</span>
          <span className="nb-sent-left__spark" aria-hidden="true">✦</span>
        </div>
      );
      rightBody = (
        <div className="nb-flow-right">
          <div className="notebook-page__title">Letter Sent</div>
          <p className="nb-sent__copy">We&apos;ve sent an ownership letter to:</p>
          <p className="nb-sent__email">{email || ownerEmail || "your inbox"}</p>
          <p className="nb-sent__hint">
            ✉ Check your inbox and follow the link inside to claim your room.
          </p>
          <button
            type="button"
            className="nb-back"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={backToRoom}
          >
            ← Back to Room
          </button>
        </div>
      );
    } else {
      leftBody = (
        <div className="nb-claim-left">
          <div className="nb-claim-left__title">
            Claim
            <br />
            This Room
          </div>
          <div className="nb-claim-left__rule" />
          <p className="nb-claim-left__copy">
            Mark this room as yours and keep your thoughts safe forever.
          </p>
          <div className="nb-deco">
            <span className="nb-deco__key" aria-hidden="true">🗝️</span>
            <span className="nb-deco__seal" aria-hidden="true">🌳</span>
            <span className="nb-deco__tag">Ownership</span>
          </div>
        </div>
      );
      rightBody = (
        <div className="nb-flow-right">
          <div className="notebook-page__title">Ownership Record</div>
          <label className="nb-field__label">Email Address</label>
          <input
            type="email"
            className="nb-field__input"
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
          <p className="nb-claim__hint">
            A magic letter will be sent to your mailbox.
          </p>
          {claimStatus === "error" && claimError && (
            <div className="notebook-claim__error">{claimError}</div>
          )}
          <button
            type="button"
            className="nb-claim__cta"
            disabled={!emailValid}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={submitClaim}
          >
            Sign &amp; Claim
          </button>
          <p className="nb-claim__sig">
            Your room. Your thoughts. Your ownership.
          </p>
        </div>
      );
    }
  }

  return (
    <group position={[0, COVER_THICKNESS + PAGE_STACK_HEIGHT + 0.003, 0]}>
      <Html
        transform
        center
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-BOOK_WIDTH / 2, 0.001, 0]}
        distanceFactor={PAGE_HTML_DISTANCE}
        zIndexRange={[60, 0]}
        pointerEvents="auto"
      >
        <div
          key={turnKey}
          className="notebook-page notebook-page--left np-turn np-turn--l"
          style={pageStyle}
          {...pageHandlers}
        >
          {leftBody}
        </div>
      </Html>

      <Html
        transform
        center
        rotation={[-Math.PI / 2, 0, 0]}
        position={[BOOK_WIDTH / 2, 0.001, 0]}
        distanceFactor={PAGE_HTML_DISTANCE}
        zIndexRange={[60, 0]}
        pointerEvents="auto"
      >
        <div
          key={turnKey}
          className="notebook-page notebook-page--right np-turn np-turn--r"
          style={pageStyle}
          {...pageHandlers}
        >
          {rightBody}
          {isBrowse && (
            <div className="nb-pagenav">
              <span className="notebook-pageturn__dots">
                {BROWSE_ORDER.map((v, i) => (
                  <span
                    key={v}
                    className={
                      "notebook-pageturn__dot" +
                      (i === browseIndex ? " notebook-pageturn__dot--on" : "")
                    }
                  />
                ))}
              </span>
              <span className="nb-pagenav__hint">drag to turn the page</span>
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

export function Notebook({
  onSelectNote,
}: {
  onSelectNote: (noteId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  // Active spread view. Lifted here so the auto-reveal effect can turn to
  // the certificate on a completed claim even while the book is shut.
  const [view, setView] = useState<NotebookView>("recentlyCreated");

  // Auto-reveal on claim success: open the book and turn to the
  // ownership certificate (stage 4).
  const claimStatus = useOwnershipStore((s) => s.claimStatus);
  useEffect(() => {
    if (claimStatus === "claimed") {
      setOpen(true);
      setView("certificate");
    }
  }, [claimStatus]);

  // Escape closes the open book.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const { coverAngle, tilt, riseY, forwardZ } = useSpring({
    coverAngle: notebookCoverRotation(open),
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
  // Clicking the book only OPENS it. Closing is via Escape or the
  // click-away catcher (clicking outside) — if this also toggled closed,
  // pressing a page to start a page-turn drag would slam the book shut.
  const onClickBook = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (!open) setOpen(true);
  };

  const handleSelect = (noteId: string) => {
    setOpen(false);
    onSelectNote(noteId);
  };

  const HALF = BOOK_WIDTH / 2;
  const coverTopY = PAGE_STACK_HEIGHT / 2 + COVER_THICKNESS / 2;

  return (
    <>
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
        rotation-x={tilt}
      >
        <group
          onPointerOver={onOver}
          onPointerOut={onOut}
          onPointerDown={onClickBook}
        >
          {/* Back cover — right half of the open book. */}
          <mesh castShadow receiveShadow position={[HALF, COVER_THICKNESS / 2, 0]}>
            <boxGeometry args={[BOOK_WIDTH, COVER_THICKNESS, BOOK_DEPTH]} />
            <meshStandardMaterial color={COVER_COLOR} roughness={0.7} metalness={0.05} />
          </mesh>

          {/* Page stack. */}
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

          {/* Spine — central binding (x=0). */}
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

          {/* Front cover — hinged at the centre spine. */}
          <animated.group
            position={[0, COVER_THICKNESS + PAGE_STACK_HEIGHT, 0]}
            rotation-z={coverAngle}
          >
            <mesh castShadow receiveShadow position={[HALF, coverTopY, 0]}>
              <boxGeometry args={[BOOK_WIDTH, COVER_THICKNESS, BOOK_DEPTH]} />
              <meshStandardMaterial color={COVER_COLOR} roughness={0.7} metalness={0.05} />
            </mesh>

            {/* Foil-stamped cover title. */}
            <group
              position={[HALF, coverTopY + COVER_THICKNESS / 2 + 0.0012, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
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

        {/* Open spread page planes. */}
        {open && (
          <group position={[0, COVER_THICKNESS + PAGE_STACK_HEIGHT + 0.002, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-BOOK_WIDTH / 2, 0, 0]}>
              <planeGeometry args={[BOOK_WIDTH * 0.94, BOOK_DEPTH * 0.94]} />
              <meshStandardMaterial
                color={OPEN_PAGE_COLOR}
                map={PAGE_PAPER_TEXTURE ?? undefined}
                roughness={0.95}
                metalness={0}
              />
            </mesh>
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

        {open && (
          <NotebookSpread
            onSelectNote={handleSelect}
            view={view}
            setView={setView}
            onClose={() => setOpen(false)}
          />
        )}

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
