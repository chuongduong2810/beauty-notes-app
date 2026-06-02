import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryCanvasRepository } from "../lib/in-memory-canvas-repository";
import { entitlementsForTier, type Tier } from "../lib/entitlements";
import { useAppStore } from "../store";
import { CustomizationPanel } from "./CustomizationPanel";

/** Seed the store with one Room owned by a Member at the given tier. */
async function seedRoom(tier: Tier) {
  const repo = new InMemoryCanvasRepository();
  const room = await repo.insertRoom("user-1", "Studio");
  useAppStore.setState({
    repo,
    session: { user: { id: "user-1" } } as never,
    currentRoom: room,
    rooms: [room],
    surfaces: await repo.listSurfaces(room.id),
    notes: [],
    annotations: [],
    entitlements: entitlementsForTier(tier),
    membershipRequested: false,
    ready: true,
  });
  return { repo, room };
}

/** Open the panel by clicking its affordance, then return. */
function openPanel() {
  fireEvent.click(screen.getByRole("button", { name: /customize/i }));
}

describe("CustomizationPanel (issue #108)", () => {
  beforeEach(() => {
    useAppStore.setState({
      currentRoom: null,
      rooms: [],
      repo: null,
      session: null,
      entitlements: entitlementsForTier("explorer"),
      membershipRequested: false,
    });
  });

  it("applies an unlocked Item to the current Room live", async () => {
    await seedRoom("resident");
    render(<CustomizationPanel />);
    openPanel();
    fireEvent.click(screen.getByRole("button", { name: /midnight/i }));
    await new Promise((r) => setTimeout(r, 10));
    expect(useAppStore.getState().currentRoom?.theme_id).toBe("midnight");
  });

  it("does not apply a locked Item and instead reveals the Membership nudge", async () => {
    await seedRoom("explorer");
    render(<CustomizationPanel />);
    openPanel();
    // "Midnight" is a resident theme — locked for an Explorer.
    fireEvent.click(screen.getByRole("button", { name: /midnight/i }));
    await new Promise((r) => setTimeout(r, 10));
    // Nothing applied, note-taking never blocked.
    expect(useAppStore.getState().currentRoom?.theme_id ?? null).toBeNull();
    // A quiet inline nudge appears with a route to Membership.
    expect(
      screen.getByRole("button", { name: /unlock with membership/i }),
    ).toBeInTheDocument();
  });

  it("routes the nudge's link to the Membership page via the store one-shot", async () => {
    await seedRoom("explorer");
    render(<CustomizationPanel />);
    openPanel();
    fireEvent.click(screen.getByRole("button", { name: /noir studio/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /unlock with membership/i }),
    );
    expect(useAppStore.getState().membershipRequested).toBe(true);
  });

  it("resizes the Room when a Studio member picks a size preset", async () => {
    await seedRoom("studio");
    render(<CustomizationPanel />);
    openPanel();
    fireEvent.click(screen.getByRole("button", { name: /grand/i }));
    await new Promise((r) => setTimeout(r, 10));
    expect(useAppStore.getState().currentRoom?.width_m).toBe(8);
  });

  it("does not resize for a non-Studio member and shows the Membership nudge", async () => {
    await seedRoom("resident");
    render(<CustomizationPanel />);
    openPanel();
    const beforeWidth = useAppStore.getState().currentRoom?.width_m;
    fireEvent.click(screen.getByRole("button", { name: /grand/i }));
    await new Promise((r) => setTimeout(r, 10));
    expect(useAppStore.getState().currentRoom?.width_m).toBe(beforeWidth);
    expect(
      screen.getByRole("button", { name: /unlock with membership/i }),
    ).toBeInTheDocument();
  });
});
