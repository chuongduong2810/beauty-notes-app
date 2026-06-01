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
import { buildRoomLedger } from "../lib/room-ledger";
import { isValidPassword, PASSWORD_HINT } from "../lib/password";
import type { Room } from "../lib/room";
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
  claimRoom: (email: string, password: string) => Promise<void>;
  resetClaim: () => void;
};

/** Read the ownership slice off the store with the contract types. */
function useOwnershipStore<T>(selector: (slice: OwnershipStoreSlice) => T): T {
  return useAppStore((s) => selector(s as unknown as OwnershipStoreSlice));
}

/**
 * Room-restore slice of the app store (issue #82 — the "restore my room"
 * magic-link flow, ADR-0019). The inverse of the ownership/claim slice
 * above: bringing a Claimed Room back onto a fresh device. Consumed
 * read-only here. Field/method names match the #82 contract verbatim.
 */
type RestoreStoreSlice = {
  restoreStatus:
    | "idle"
    | "sending"
    | "sent"
    | "restoring"
    | "selecting"
    | "empty"
    | "done"
    | "error";
  restoreError: string | null;
  /** Candidate Rooms for the "Your Rooms" selection page (issue #83). */
  restorableRooms: Room[];
  sendRestoreLink: (email: string) => Promise<void>;
  /** Load the chosen Room and finish the restore flow (issue #83). */
  restoreIntoRoom: (roomId: string) => Promise<void>;
  resetRestore: () => void;
};

/** Read the restore slice off the store with the contract types. */
function useRestoreStore<T>(selector: (slice: RestoreStoreSlice) => T): T {
  return useAppStore((s) => selector(s as unknown as RestoreStoreSlice));
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
  | "restore"
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
  const claimStatus = useOwnershipStore((s) => s.claimStatus);
  const claimError = useOwnershipStore((s) => s.claimError);
  const claimRoom = useOwnershipStore((s) => s.claimRoom);
  const resetClaim = useOwnershipStore((s) => s.resetClaim);
  const restoreStatus = useRestoreStore((s) => s.restoreStatus);
  const restoreError = useRestoreStore((s) => s.restoreError);
  const restorableRooms = useRestoreStore((s) => s.restorableRooms);
  const sendRestoreLink = useRestoreStore((s) => s.sendRestoreLink);
  const restoreIntoRoom = useRestoreStore((s) => s.restoreIntoRoom);
  const resetRestore = useRestoreStore((s) => s.resetRestore);

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
  // Claim now also sets a Password (issue #94, ADR-0020) so the Room can
  // be Restored instantly without an email later. Validated against the
  // #93 policy helper; the CTA stays disabled until both fields are valid.
  const [password, setPassword] = useState("");
  const passwordValid = isValidPassword(password);
  // Consent gate for the guest-cleanup that Restore performs (issue #84,
  // ADR-0019): reopening a claimed room signs this device out of its guest
  // identity, so any rooms made here as a guest are cleared. The user must
  // tick this before we'll send the link.
  const [restoreConsented, setRestoreConsented] = useState(false);

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

  const submitClaim = () => {
    if (!emailValid || !passwordValid || claimStatus === "sending") return;
    void claimRoom(email.trim(), password);
  };

  const submitRestore = () => {
    if (!emailValid || !restoreConsented || restoreStatus === "sending") return;
    void sendRestoreLink(email.trim());
  };

  // Choose a Room from the "Your Rooms" page (issue #83): load it, then
  // close the book to fly in — mirrors how the ledger's note rows navigate.
  const chooseRoom = (roomId: string) => {
    void restoreIntoRoom(roomId);
    onClose();
  };

  const backToRoom = () => {
    resetClaim();
    resetRestore();
    setRestoreConsented(false);
    onClose();
  };

  // Retry a failed send (issue #85): reset the restore flow back to "idle"
  // (clearing the soft error) but stay on the restore spread so the User
  // lands on the email form again rather than being kicked back to the Room.
  const tryRestoreAgain = () => {
    resetRestore();
    setRestoreConsented(false);
  };

  // Re-mounts both pages on any view/stage change so the page-turn
  // animation replays.
  const turnKey = `${view}:${claimStatus}:${restoreStatus}`;

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
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setView(key)}
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
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setView("ledger")}
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
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => claimed && setView("certificate")}
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
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onSelectNote(n.id)}
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
            <>
              <button
                type="button"
                className="nb-ledger__claim"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setView("claim")}
              >
                Claim This Room <span aria-hidden="true">→</span>
              </button>
              {/* Guest-only Restore entry (issue #82, ADR-0019): reopen a
                  previously Claimed Room on this fresh device. */}
              <button
                type="button"
                className="nb-ledger__restore"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setView("restore")}
              >
                Already have a room? Restore it{" "}
                <span aria-hidden="true">→</span>
              </button>
            </>
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
  } else if (view === "restore") {
    // ── Restore flow (full spread, issue #82 / ADR-0019): stage 2 form,
    // stage 3 letter sent, or the "Your Rooms" selection page when the
    // restored account owns more than one Room (issue #83). The unhappy
    // paths (issue #85) add a "no room found" page (zero Rooms) and a
    // friendly, retryable send-failure page. Mirrors the Claim spread's
    // structure. ────────────────────────────────────────────────────────
    const sent = restoreStatus === "sent" || restoreStatus === "sending";
    if (restoreStatus === "selecting") {
      // ── Stage: "Your Rooms" — pick which Room to fly into (issue #83). ──
      leftBody = (
        <div className="nb-claim-left">
          <div className="nb-claim-left__title">
            Your
            <br />
            Rooms
          </div>
          <div className="nb-claim-left__rule" />
          <p className="nb-claim-left__copy">
            We found more than one room for this account. Choose the one
            you&apos;d like to step into.
          </p>
          <div className="nb-deco">
            <span className="nb-deco__key" aria-hidden="true">🗝️</span>
            <span className="nb-deco__seal" aria-hidden="true">🚪</span>
            <span className="nb-deco__tag">Restore</span>
          </div>
        </div>
      );
      rightBody = (
        <div className="nb-flow-right">
          <div className="notebook-page__title">Pick a Room</div>
          <div className="notebook-list">
            {restorableRooms.map((room) => (
              <button
                key={room.id}
                type="button"
                className="notebook-entry"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => chooseRoom(room.id)}
              >
                <span className="notebook-entry__swatch nb-room-swatch" aria-hidden="true">
                  🚪
                </span>
                <span className="notebook-entry__text">
                  {room.name?.trim() || "Untitled Room"}
                </span>
                <span className="notebook-entry__time">
                  {timeAgo(room.updated_at)}
                </span>
              </button>
            ))}
          </div>
        </div>
      );
    } else if (restoreStatus === "empty") {
      // ── Stage: "no room found" — the account owns zero Rooms (issue #85).
      // A gentle dead-end: nothing was loaded and no empty Room was created;
      // offer a way back / to try a different email. ──────────────────────
      leftBody = (
        <div className="nb-claim-left nb-empty-left">
          <div className="nb-claim-left__title">
            No Room
            <br />
            Found
          </div>
          <div className="nb-claim-left__rule" />
          <p className="nb-claim-left__copy">
            This mailbox isn&apos;t holding a room just yet — nothing was
            opened, and nothing was changed.
          </p>
          <div className="nb-deco">
            <span className="nb-deco__key" aria-hidden="true">🗝️</span>
            <span className="nb-deco__seal" aria-hidden="true">🚪</span>
            <span className="nb-deco__tag">Restore</span>
          </div>
        </div>
      );
      rightBody = (
        <div className="nb-flow-right nb-empty">
          <div className="notebook-page__title">We couldn&apos;t find a room</div>
          <span className="nb-empty__mark" aria-hidden="true">🕯️</span>
          <p className="nb-empty__copy">
            We couldn&apos;t find a room for that email. If you claimed a room
            with a different address, try that one instead.
          </p>
          <button
            type="button"
            className="nb-claim__cta"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={tryRestoreAgain}
          >
            Try a different email
          </button>
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
    } else if (restoreStatus === "error") {
      // ── Stage: send failure (issue #85) — a friendly, retryable error.
      // Show the reason softly and let the User hop back to the email form
      // (tryRestoreAgain resets to "idle" without leaving the spread). ─────
      leftBody = (
        <div className="nb-claim-left nb-error-left">
          <div className="nb-claim-left__title">
            Something
            <br />
            Slipped
          </div>
          <div className="nb-claim-left__rule" />
          <p className="nb-claim-left__copy">
            The letter didn&apos;t make it out this time. No rooms were
            touched — you can try again in a moment.
          </p>
          <div className="nb-deco">
            <span className="nb-deco__key" aria-hidden="true">🗝️</span>
            <span className="nb-deco__seal" aria-hidden="true">🚪</span>
            <span className="nb-deco__tag">Restore</span>
          </div>
        </div>
      );
      rightBody = (
        <div className="nb-flow-right nb-error">
          <div className="notebook-page__title">We couldn&apos;t send it</div>
          <span className="nb-error__mark" aria-hidden="true">✉️</span>
          <p className="nb-error__copy">
            We couldn&apos;t send your letter just now. Please try again.
          </p>
          {restoreError && (
            <p className="nb-error__detail">{restoreError}</p>
          )}
          <button
            type="button"
            className="nb-claim__cta"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={tryRestoreAgain}
          >
            Try Again
          </button>
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
    } else if (sent) {
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
          <p className="nb-sent__copy">
            If a room is registered to this email, a letter is on its way to:
          </p>
          <p className="nb-sent__email">{email || "your inbox"}</p>
          <p className="nb-sent__hint">
            ✉ Check your inbox and follow the link inside to reopen your room.
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
      // Layout note: the warning + consent gate lives on the LEFT page and
      // the email form on the RIGHT, so neither page overflows the fixed
      // 200×272 paper (the single-page cram clipped the email + buttons).
      leftBody = (
        <div className="nb-claim-left nb-restore-left">
          <div className="nb-restore-left__title">
            Restore
            <br />
            Your Room
          </div>
          <div className="nb-claim-left__rule" />
          <p className="nb-restore-left__copy">
            Reopen a room you&apos;ve claimed — just as you left it.
          </p>
          <div className="nb-restore-warn">
            <p className="nb-restore-warn__title">
              ⚠️ This clears your guest rooms
            </p>
            <p className="nb-restore-warn__copy">
              The guest rooms on this device are cleared and can&apos;t be
              brought back.
            </p>
            <label className="nb-restore-consent">
              <input
                type="checkbox"
                checked={restoreConsented}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => setRestoreConsented(e.target.checked)}
              />
              <span>I understand — clear my guest rooms.</span>
            </label>
          </div>
        </div>
      );
      rightBody = (
        <div className="nb-flow-right">
          <div className="notebook-page__title">Reopen Your Room</div>
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
              if (e.key === "Enter") submitRestore();
            }}
          />
          <p className="nb-claim__hint">
            A magic letter will be sent to your mailbox. Tick the note on the
            left, then send.
          </p>
          <button
            type="button"
            className="nb-claim__cta"
            disabled={!emailValid || !restoreConsented}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={submitRestore}
          >
            Send Magic Link
          </button>
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
    }
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
          <label className="nb-field__label">Password</label>
          <input
            type="password"
            className="nb-field__input"
            placeholder="••••••••"
            value={password}
            autoComplete="new-password"
            spellCheck={false}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitClaim();
            }}
          />
          <p className="nb-claim__hint">{PASSWORD_HINT}</p>
          {claimStatus === "error" && claimError && (
            <div className="notebook-claim__error">{claimError}</div>
          )}
          <button
            type="button"
            className="nb-claim__cta"
            disabled={!emailValid || !passwordValid}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={submitClaim}
          >
            Sign &amp; Claim
          </button>
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
        >
          {leftBody}
          {/* Folded-corner "previous page" — turns back (browse cycles;
              the ownership spreads turn back to the ledger). */}
          <button
            type="button"
            className="nb-corner nb-corner--prev"
            aria-label="Previous page"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => commitTurn(-1)}
          >
            <span className="nb-corner__chev" aria-hidden="true">‹</span>
          </button>
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
            </div>
          )}
          {/* Folded-corner "next page" — only in browse (cycles the
              sections + Room Ledger). */}
          {isBrowse && (
            <button
              type="button"
              className="nb-corner nb-corner--next"
              aria-label="Next page"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => commitTurn(1)}
            >
              <span className="nb-corner__chev" aria-hidden="true">›</span>
            </button>
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

  // Auto-reveal on a restore return that needs the User's attention: a
  // multi-room return shows the "Your Rooms" page (issue #83, "selecting"),
  // and a zero-room return shows the "no room found" page (issue #85,
  // "empty"). Both can land while the book is shut, so open it and turn to
  // the restore spread.
  const restoreStatus = useRestoreStore((s) => s.restoreStatus);
  useEffect(() => {
    if (restoreStatus === "selecting" || restoreStatus === "empty") {
      setOpen(true);
      setView("restore");
    }
  }, [restoreStatus]);

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

        {/* Open spread page planes. They swallow pointer-downs so a click
            on the paper doesn't fall through to the click-away catcher
            behind and close the book (the catcher only fires on a true
            click OUTSIDE the book now). */}
        {open && (
          <group position={[0, COVER_THICKNESS + PAGE_STACK_HEIGHT + 0.002, 0]}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[-BOOK_WIDTH / 2, 0, 0]}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <planeGeometry args={[BOOK_WIDTH * 0.94, BOOK_DEPTH * 0.94]} />
              <meshStandardMaterial
                color={OPEN_PAGE_COLOR}
                map={PAGE_PAPER_TEXTURE ?? undefined}
                roughness={0.95}
                metalness={0}
              />
            </mesh>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[BOOK_WIDTH / 2, 0, 0]}
              onPointerDown={(e) => e.stopPropagation()}
            >
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
