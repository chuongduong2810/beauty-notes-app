import { useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { useAppStore } from "../store";

/**
 * In-app Stripe **Embedded Checkout** (issue #106, ADR-0023). Instead of
 * redirecting to Stripe's hosted page, the payment UI renders in an iframe
 * inside a modal so the User never leaves the Room. Driven entirely by the
 * store's `checkoutClientSecret` (set by `stripeBillingProvider`); on
 * completion the webhook records the Membership, so we refresh entitlements
 * and close.
 *
 * Rendered at the DOM layer in App.tsx (a sibling of the WebGL Canvas), like
 * the NoteEditor / Search overlays — not inside the 3D scene.
 */

// Publishable key is non-secret. Load Stripe once at module scope.
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as
  | string
  | undefined;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export function CheckoutModal() {
  const clientSecret = useAppStore((s) => s.checkoutClientSecret);
  const closeCheckout = useAppStore((s) => s.closeCheckout);
  const refreshMembership = useAppStore((s) => s.refreshMembership);

  // Escape closes the modal (matches the rest of the app's overlays).
  useEffect(() => {
    if (!clientSecret) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCheckout();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clientSecret, closeCheckout]);

  if (!clientSecret) return null;

  const onComplete = () => {
    // Payment succeeded in-app. The `stripe-webhook` writes the Membership
    // row server-side; poll a couple of times to beat the webhook latency so
    // entitlements unlock without a reload, then close.
    void refreshMembership();
    window.setTimeout(() => void refreshMembership(), 2500);
    window.setTimeout(() => closeCheckout(), 3500);
  };

  return (
    <div
      style={backdropStyle}
      onClick={closeCheckout}
      role="dialog"
      aria-modal="true"
    >
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          style={closeStyle}
          onClick={closeCheckout}
          aria-label="Close checkout"
        >
          ×
        </button>
        {stripePromise ? (
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ clientSecret, onComplete }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        ) : (
          <div style={missingKeyStyle}>
            Stripe isn’t configured — set <code>VITE_STRIPE_PUBLISHABLE_KEY</code>.
          </div>
        )}
      </div>
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  background: "rgba(14, 11, 22, 0.66)",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const panelStyle: React.CSSProperties = {
  position: "relative",
  width: "min(460px, 100%)",
  maxHeight: "90vh",
  overflow: "auto",
  background: "#fffdf7",
  borderRadius: 14,
  boxShadow: "0 18px 60px rgba(0,0,0,0.5)",
  padding: "20px 16px 16px",
};

const closeStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  right: 10,
  zIndex: 1,
  width: 28,
  height: 28,
  borderRadius: 999,
  border: "none",
  background: "rgba(0,0,0,0.06)",
  color: "#43301f",
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
};

const missingKeyStyle: React.CSSProperties = {
  padding: 24,
  fontFamily: "var(--ui-font)",
  color: "#9a3b1c",
  fontSize: 14,
  textAlign: "center",
};
