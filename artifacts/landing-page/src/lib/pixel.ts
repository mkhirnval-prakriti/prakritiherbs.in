/**
 * Meta Pixel — centralized event helpers
 * Pixel ID: 1188710012812588
 *
 * Guards:
 * - sessionStorage flags prevent double-firing per action
 * - All calls are wrapped in try/catch so pixel errors never break order flow
 */

const PIXEL_ID = "1188710012812588";
const SS_PURCHASE_KEY = "pixel_payment_initiated";
const SS_PURCHASE_FIRED = "pixel_purchase_fired";

/**
 * Generate a unique event ID for client–server deduplication.
 * The same ID must be passed to both the browser fbq() call and the
 * server-side CAPI call so Meta counts them as one event, not two.
 */
export function generateEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Read a cookie value by name from document.cookie.
 * Returns undefined if not found or if cookies aren't accessible.
 */
export function getCookie(name: string): string | undefined {
  try {
    const match = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
  } catch {
    return undefined;
  }
}

function fbq(event: string, name: string, params?: Record<string, unknown>): void {
  try {
    const fn = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
    if (typeof fn === "function") {
      fn("track", name, params ?? {});
    }
  } catch {
    // Pixel errors must never affect the order flow
  }
}

/** Fire on every route change inside the SPA */
export function firePageView(): void {
  fbq("track", "PageView");
}

/** Fire when COD order is successfully submitted — Purchase event for ROAS tracking */
export function fireLead(params?: { name?: string; phone?: string; eventId?: string; value?: number }): void {
  fbq("track", "Purchase", {
    content_name: "KamaSutra Gold+",
    currency: "INR",
    value: params?.value ?? 999,
    ...(params?.eventId ? { eventID: params.eventId } : {}),
  });
}

/** Fire when user clicks Pay Now (before Cashfree redirect) */
export function fireInitiateCheckout(params?: { quantity?: number }): void {
  fbq("track", "InitiateCheckout", {
    content_name: "KamaSutra Gold+",
    currency: "INR",
    value: 999,
    num_items: params?.quantity ?? 1,
  });
}

/**
 * Mark that a payment was initiated so Purchase can fire on return.
 * Call this right before redirecting to Cashfree.
 */
export function markPaymentInitiated(): void {
  try {
    sessionStorage.setItem(SS_PURCHASE_KEY, "1");
    sessionStorage.removeItem(SS_PURCHASE_FIRED);
  } catch {
    // ignore
  }
}

/**
 * Parse the current URL search params and determine if this looks like a
 * successful Cashfree payment return.
 *
 * Detection uses a three-tier approach so it works across all browsers:
 *
 *  Tier 1 — Explicit status params (most reliable):
 *    Cashfree appends `payment_status` or `txStatus` to the return URL.
 *    We only fire Purchase when the value is a known-success string.
 *    We actively suppress on known-failure values to avoid false Purchase events.
 *
 *  Tier 2 — Order-reference params (no status param present):
 *    If Cashfree appended `order_id`, `cf_order_id`, or `referenceId` without
 *    a status param, we treat it as a successful return (failed payments
 *    typically redirect to an error page, not back to the merchant site).
 *
 *  Tier 3 — Referrer fallback (Safari / Firefox private mode, etc.):
 *    `document.referrer` is checked as a last resort when URL params are absent.
 *    Browsers that strip referrers will miss this tier — which is why Tiers 1/2
 *    are the primary path.
 *
 * The sessionStorage flag (SS_PURCHASE_KEY) must already be set (via
 * markPaymentInitiated) for any tier to trigger. This ensures we never fire
 * Purchase for visitors who land on the page without having clicked Pay Now.
 */
function detectCashfreeReturn(): { detected: boolean; orderId?: string } {
  const params = new URLSearchParams(window.location.search);

  const orderId =
    params.get("order_id") ??
    params.get("cf_order_id") ??
    params.get("referenceId") ??
    undefined;

  // --- Tier 1: Explicit status param ---
  const paymentStatus = (
    params.get("payment_status") ??
    params.get("txStatus") ??
    params.get("status") ??
    ""
  ).toUpperCase();

  const SUCCESS_VALUES = new Set(["SUCCESS", "PAID", "COMPLETED", "OK"]);
  const FAILURE_VALUES = new Set(["FAILED", "FAILURE", "CANCELLED", "CANCELED", "ERROR", "PENDING"]);

  if (paymentStatus) {
    if (SUCCESS_VALUES.has(paymentStatus)) {
      return { detected: true, orderId };
    }
    if (FAILURE_VALUES.has(paymentStatus)) {
      // Explicit failure — do not fire Purchase
      return { detected: false };
    }
  }

  // --- Tier 2: Order-reference params (status absent) ---
  if (orderId) {
    return { detected: true, orderId };
  }

  // --- Tier 3: Referrer fallback ---
  const ref = (document.referrer ?? "").toLowerCase();
  if (
    ref.includes("cashfree") ||
    ref.includes("payments.cashfree.com") ||
    ref.includes("forms/kama")
  ) {
    return { detected: true };
  }

  return { detected: false };
}

/**
 * Call once on app load (App.tsx useEffect).
 * Fires the Purchase pixel event exactly once if the user just returned from
 * a successful Cashfree payment.
 *
 * Guards:
 *  - SS_PURCHASE_FIRED in sessionStorage prevents any duplicate within the session.
 *  - SS_PURCHASE_KEY must be present (set by markPaymentInitiated on Pay Now click).
 *  - detectCashfreeReturn() must confirm a successful return.
 */
export function checkAndFirePurchase(): void {
  try {
    // Guard 1: already fired this session
    if (sessionStorage.getItem(SS_PURCHASE_FIRED)) return;

    // Guard 2: user must have clicked Pay Now first
    if (!sessionStorage.getItem(SS_PURCHASE_KEY)) return;

    const { detected, orderId } = detectCashfreeReturn();
    if (!detected) return;

    // Mark as fired before the fbq call so a re-render can never double-fire
    sessionStorage.setItem(SS_PURCHASE_FIRED, "1");
    sessionStorage.removeItem(SS_PURCHASE_KEY);

    fbq("track", "Purchase", {
      content_name: "KamaSutra Gold+",
      currency: "INR",
      value: 999,
      ...(orderId ? { order_id: orderId } : {}),
    });

    console.log("[Pixel] Purchase event fired", orderId ? `order_id=${orderId}` : "(no order_id in URL)");
  } catch {
    // Pixel errors must never affect the page
  }
}

export { PIXEL_ID };
