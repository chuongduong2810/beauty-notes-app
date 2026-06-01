import { beforeEach, describe, expect, it } from "vitest";
import { getBillingProvider, mockBillingProvider } from "./billing";
import { entitlementsForTier } from "./entitlements";
import { useAppStore } from "../store";

describe("mockBillingProvider (issue #105, ADR-0023)", () => {
  beforeEach(() => {
    // Start from the Explorer baseline, as a fresh session would.
    useAppStore.setState({
      membership: null,
      entitlements: entitlementsForTier("explorer"),
    });
  });

  it("getBillingProvider returns the mock for now (real provider in #106)", () => {
    expect(getBillingProvider()).toBe(mockBillingProvider);
  });

  it("flips the store to an active Resident membership + entitlements", async () => {
    await mockBillingProvider.startCheckout("resident");

    const { membership, entitlements } = useAppStore.getState();
    expect(membership?.tier).toBe("resident");
    expect(membership?.status).toBe("active");
    // Resident unlocks Photo Mode + Camera Viewpoints but stays single-room.
    expect(entitlements.photoMode).toBe(true);
    expect(entitlements.cameraViewpoints).toBe(true);
    expect(entitlements.maxRooms).toBe(1);
    expect(entitlements.blueprintMode).toBe(false);
  });

  it("flips the store to Studio entitlements (unlimited rooms, blueprint)", async () => {
    await mockBillingProvider.startCheckout("studio");

    const { entitlements } = useAppStore.getState();
    expect(entitlements.maxRooms).toBe(Infinity);
    expect(entitlements.blueprintMode).toBe(true);
    expect(entitlements.advancedCustomization).toBe(true);
  });

  it("resolves with no redirect url (client-side only stand-in)", async () => {
    const result = await mockBillingProvider.startCheckout("resident");
    expect(result).toBeUndefined();
  });
});
