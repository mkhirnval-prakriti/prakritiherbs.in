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

/** Fire when COD order is successfully submitted */
export function fireLead(params?: { name?: string; phone?: string }): void {
  fbq("track", "Lead", {
    content_name: "KamaSutra Gold+",
    currency: "INR",
    value: 999,
    ...(params ?? {}),
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
 * Call once on app load (App.tsx useEffect).
 * If the user just returned from Cashfree after a payment attempt,
 * fire the Purchase event exactly once.
 */
export function checkAndFirePurchase(): void {
  try {
    const initiated = sessionStorage.getItem(SS_PURCHASE_KEY);
    const alreadyFired = sessionStorage.getItem(SS_PURCHASE_FIRED);
    if (!initiated || alreadyFired) return;

    const ref = document.referrer ?? "";
    const returnedFromPayment =
      ref.includes("cashfree") ||
      ref.includes("payments.cashfree.com") ||
      ref.includes("forms/kama");

    if (!returnedFromPayment) return;

    // Fire once and clear flag
    sessionStorage.removeItem(SS_PURCHASE_KEY);
    sessionStorage.setItem(SS_PURCHASE_FIRED, "1");

    fbq("track", "Purchase", {
      content_name: "KamaSutra Gold+",
      currency: "INR",
      value: 999,
    });

    console.log("[Pixel] Purchase event fired (return from Cashfree)");
  } catch {
    // ignore
  }
}

export { PIXEL_ID };
