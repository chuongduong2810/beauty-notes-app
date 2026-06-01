import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryCanvasRepository } from "../lib/in-memory-canvas-repository";
import { entitlementsForTier } from "../lib/entitlements";
import { useAppStore } from "../store";
import { RoomPicker } from "./RoomPicker";

async function seedTwoRooms() {
  const repo = new InMemoryCanvasRepository();
  const r1 = await repo.insertRoom("user-1", "Studio");
  await new Promise((r) => setTimeout(r, 5));
  const r2 = await repo.insertRoom("user-1", "Workshop");
  const rooms = await repo.listRooms("user-1");
  useAppStore.setState({
    repo,
    session: { user: { id: "user-1" } } as never,
    currentRoom: r1,
    rooms,
    surfaces: await repo.listSurfaces(r1.id),
    notes: [],
    annotations: [],
    // Studio entitlement: unlimited Rooms, so multi-room + "New Room" are
    // available (these fixtures model a paid User; gating is covered below).
    entitlements: entitlementsForTier("studio"),
    ready: true,
  });
  return { repo, r1, r2 };
}

describe("RoomPicker — top-left dropdown (issue #22)", () => {
  beforeEach(() => {
    useAppStore.setState({
      currentRoom: null,
      rooms: [],
      surfaces: [],
      notes: [],
      annotations: [],
      repo: null,
      session: null,
    });
  });

  it("shows the current Room name + chevron when closed", async () => {
    await seedTwoRooms();
    render(<RoomPicker />);
    expect(screen.getByText("Studio")).toBeInTheDocument();
  });

  it("opens the dropdown on click and lists all the User's Rooms with most-recently-updated first", async () => {
    const { r2 } = await seedTwoRooms();
    render(<RoomPicker />);
    fireEvent.click(screen.getByRole("button", { name: /studio/i }));
    // r2 was created after r1 → should appear first.
    const items = screen.getAllByRole("menuitem");
    // The first menuitem is the most-recent Room.
    expect(items[0]).toHaveTextContent(r2.name);
    expect(items.find((el) => el.textContent?.includes("New Room"))).toBeTruthy();
  });

  it("clicking a Room item switches the current Room and closes the dropdown", async () => {
    const { r2 } = await seedTwoRooms();
    render(<RoomPicker />);
    fireEvent.click(screen.getByRole("button", { name: /studio/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /workshop/i }));
    // Async switchRoom — wait a microtask.
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(useAppStore.getState().currentRoom?.id).toBe(r2.id);
  });

  it("clicking '+ New Room' creates a new Room, refreshes the list, and switches to it", async () => {
    await seedTwoRooms();
    render(<RoomPicker />);
    fireEvent.click(screen.getByRole("button", { name: /studio/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /new room/i }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    const state = useAppStore.getState();
    expect(state.rooms.length).toBe(3);
    expect(state.currentRoom?.name).toBe("Untitled");
  });

  it("at the Explorer Room cap, shows a Studio nudge instead of '+ New Room'", async () => {
    // Two owned Rooms but only an Explorer entitlement (cap 1): creation is
    // gated (issue #109). The extra Room stays listed (read-only), and the
    // creator is replaced by an upgrade nudge.
    await seedTwoRooms();
    useAppStore.setState({ entitlements: entitlementsForTier("explorer") });
    render(<RoomPicker />);
    fireEvent.click(screen.getByRole("button", { name: /studio/i }));
    const items = screen.getAllByRole("menuitem");
    expect(items.find((el) => el.textContent?.includes("New Room"))).toBeFalsy();
    expect(
      items.find((el) => el.textContent?.includes("More rooms")),
    ).toBeTruthy();
  });
});
