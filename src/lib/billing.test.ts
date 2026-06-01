import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBillingProvider,
  mockBillingProvider,
  stripeBillingProvider,
} from "./billing";
import { entitlementsForTier } from "./entitlements";
import { useAppStore } from "../store";

// Mock the Supabase client so the real provider's Edge Function call is
// controllable and never hits the network. Hoisted so the vi.mock factory
// can close over the spy.
const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("./supabase", () => ({
  supabase: { functions: { invoke: invokeMock }, auth: {} },
}));

describe("mockBillingProvider (issue #105, ADR-0023)", () => {
  beforeEach(() => {
    // Start from the Explorer baseline, as a fresh session would.
    useAppStore.setState({
      membership: null,
      entitlements: entitlementsForTier("explorer"),
    });
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

describe("getBillingProvider selection (issue #106, ADR-0023)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns the mock when Stripe is not enabled", () => {
    // Stub explicitly so the result doesn't depend on the ambient
    // VITE_STRIPE_ENABLED in .env.local (which may be "true" in dev).
    vi.stubEnv("VITE_STRIPE_ENABLED", "false");
    expect(getBillingProvider()).toBe(mockBillingProvider);
  });

  it("returns the Stripe provider when VITE_STRIPE_ENABLED is 'true'", () => {
    vi.stubEnv("VITE_STRIPE_ENABLED", "true");
    expect(getBillingProvider()).toBe(stripeBillingProvider);
  });
});

describe("stripeBillingProvider (issue #106, ADR-0023)", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useAppStore.setState({ checkoutClientSecret: null });
  });

  it("invokes create-checkout-session with the tier and opens the in-app modal", async () => {
    invokeMock.mockResolvedValue({
      data: { clientSecret: "cs_test_abc123" },
      error: null,
    });

    await stripeBillingProvider.startCheckout("studio");

    expect(invokeMock).toHaveBeenCalledWith(
      "create-checkout-session",
      expect.objectContaining({
        body: expect.objectContaining({ tier: "studio" }),
      }),
    );
    // Opens the Embedded Checkout modal via the store, no redirect.
    expect(useAppStore.getState().checkoutClientSecret).toBe("cs_test_abc123");
  });

  it("throws when the Edge Function returns no client secret", async () => {
    invokeMock.mockResolvedValue({ data: {}, error: null });
    await expect(stripeBillingProvider.startCheckout("resident")).rejects.toThrow();
  });

  it("throws when the Edge Function errors", async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(stripeBillingProvider.startCheckout("resident")).rejects.toThrow();
  });
});
