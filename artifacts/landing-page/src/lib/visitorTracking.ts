/* Visitor source detection + UTM capture + CRM source builder + live ping beacon */

export type VisitorSource = "Facebook" | "Instagram" | "WhatsApp" | "Google" | "Direct";

/* ─────────────────────────────────────────────────────────────────
 * UTM Parameter Capture
 *
 * On first visit, saves utm_source / utm_medium / utm_campaign from
 * the URL into localStorage. Persists across page refreshes.
 * Cleared after a successful order (same as agencySource).
 * ───────────────────────────────────────────────────────────────── */
const UTM_KEY = "_pk_utm";

export interface UtmParams {
  source:   string;   // utm_source
  medium:   string;   // utm_medium
  campaign: string;   // utm_campaign
}

export function captureUtmParams(): void {
  if (typeof window === "undefined") return;
  try {
    const p = new URLSearchParams(window.location.search);
    const src = p.get("utm_source")?.trim() ?? "";
    const med = p.get("utm_medium")?.trim() ?? "";
    const cam = p.get("utm_campaign")?.trim() ?? "";
    // Only overwrite if at least one UTM param is present in the URL
    if (src || med || cam) {
      localStorage.setItem(UTM_KEY, JSON.stringify({ source: src, medium: med, campaign: cam }));
    }
  } catch { /* private mode */ }
}

export function getUtmParams(): UtmParams {
  try {
    const raw = localStorage.getItem(UTM_KEY);
    if (raw) return JSON.parse(raw) as UtmParams;
  } catch { /* ignore */ }
  return { source: "", medium: "", campaign: "" };
}

export function clearUtmParams(): void {
  try { localStorage.removeItem(UTM_KEY); } catch { /* ignore */ }
}

/* ─────────────────────────────────────────────────────────────────
 * CRM Source Builder
 *
 * Computes the human-readable `websiteSource` string to send to CRM.
 *
 * Priority (highest → lowest):
 *  1. Agency slug  (?source=taj)   → "Agency: Taj"
 *  2. UTM source   (utm_source=)   → "Meta Ads - Facebook" / "Meta Ads - Instagram" / etc.
 *  3. fbclid / igshid URL params   → "Meta Ads - Facebook" / "Meta Ads - Instagram"
 *  4. visitorSource (from referrer) → "Meta Ads - Facebook" / "Meta Ads - Instagram" / etc.
 *  5. Fallback                      → "Website Direct"
 * ───────────────────────────────────────────────────────────────── */
export function buildCrmSource(agencySource: string, visitorSource: VisitorSource): string {
  // Priority 1 — Agency link (?source=taj, ?source=agency1, …)
  if (agencySource) {
    const capitalized = agencySource.charAt(0).toUpperCase() + agencySource.slice(1);
    return `Agency: ${capitalized}`;
  }

  // Priority 2 — UTM params (most reliable for ad campaigns)
  const utm = getUtmParams();
  if (utm.source) {
    const s = utm.source.toLowerCase();
    if (s.includes("facebook") || s === "fb") return "Meta Ads - Facebook";
    if (s.includes("instagram") || s === "ig") return "Meta Ads - Instagram";
    if (s.includes("google"))                  return "Google Ads";
    if (s.includes("whatsapp") || s === "wa")  return "WhatsApp";
    if (s.includes("youtube"))                 return "YouTube";
    // Unknown UTM source → use it as-is for transparency
    const label = utm.source.charAt(0).toUpperCase() + utm.source.slice(1);
    return `UTM: ${label}`;
  }

  // Priority 3 — Check fbclid/igshid/gclid directly in current URL
  if (typeof window !== "undefined") {
    const p = new URLSearchParams(window.location.search);
    if (p.has("fbclid")) return "Meta Ads - Facebook";
    if (p.has("igshid")) return "Meta Ads - Instagram";
    if (p.has("gclid"))  return "Google Ads";
  }

  // Priority 4 — Visitor source detected from referrer
  if (visitorSource === "Facebook")  return "Meta Ads - Facebook";
  if (visitorSource === "Instagram") return "Meta Ads - Instagram";
  if (visitorSource === "WhatsApp")  return "WhatsApp";
  if (visitorSource === "Google")    return "Google Ads";

  // Priority 5 — Fallback
  return "Website Direct";
}

/* ─────────────────────────────────────────────────────────────────
 * Agency Source Tracking  (?source=taj → "taj")
 *
 * Priority:
 *  1. URL param ?source=  — ALWAYS wins; overwrites any stored value
 *  2. localStorage "_pk_asrc"  — survives page navigation / refreshes
 *  3. "" (empty)  — no agency attributed
 *
 * Call getAgencySource() anywhere on the frontend. It is safe to call
 * multiple times — it reads once and caches within the session.
 * ───────────────────────────────────────────────────────────────── */
const AGENCY_SRC_KEY = "_pk_asrc";

export function getAgencySource(): string {
  if (typeof window === "undefined") return "";

  // Priority 1: URL param is present → always overwrite stored value
  const urlParam = new URLSearchParams(window.location.search).get("source");
  if (urlParam && urlParam.trim()) {
    const src = urlParam.trim().toLowerCase();
    try { localStorage.setItem(AGENCY_SRC_KEY, src); } catch { /* private mode */ }
    return src;
  }

  // Priority 2: Persisted from a previous page load that had ?source=
  try {
    const stored = localStorage.getItem(AGENCY_SRC_KEY);
    if (stored) return stored;
  } catch { /* private mode */ }

  return "";
}

/** Call after a successful order submission to clear the agency attribution */
export function clearAgencySource(): void {
  try { localStorage.removeItem(AGENCY_SRC_KEY); } catch { /* ignore */ }
}

/* ─────────────────────────────────────────────────────────────────
 * Landing Page URL Capture
 *
 * Captures the FIRST URL the visitor lands on (full href including
 * query string). If a ?source= param is present in the URL, the
 * landing URL is always overwritten so a new agency link always
 * records the correct attribution URL.
 *
 * Stored in localStorage "_pk_lpurl" — survives page navigation.
 * Cleared after order is placed.
 * ───────────────────────────────────────────────────────────────── */
const LANDING_URL_KEY = "_pk_lpurl";

export function captureLandingUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const currentUrl = window.location.href;
    const hasSource = new URLSearchParams(window.location.search).has("source");
    // Always overwrite when ?source= is present (new agency link clicked)
    // Otherwise only set if not already captured (preserve true landing page)
    if (hasSource || !localStorage.getItem(LANDING_URL_KEY)) {
      localStorage.setItem(LANDING_URL_KEY, currentUrl);
    }
  } catch { /* private mode */ }
}

export function getLandingPageUrl(): string {
  try { return localStorage.getItem(LANDING_URL_KEY) ?? ""; } catch { return ""; }
}

export function clearLandingPageUrl(): void {
  try { localStorage.removeItem(LANDING_URL_KEY); } catch { /* ignore */ }
}

function detectSource(): VisitorSource {
  if (typeof window === "undefined") return "Direct";
  const params = new URLSearchParams(window.location.search);
  const utm = params.get("utm_source")?.toLowerCase() ?? "";
  const ref = params.get("ref")?.toLowerCase() ?? "";
  const fbclid = params.get("fbclid");
  const igshid = params.get("igshid");
  const gclid = params.get("gclid");
  const referrer = document.referrer.toLowerCase();

  if (fbclid || utm.includes("facebook") || utm === "fb" || ref === "fb" || referrer.includes("facebook.com") || referrer.includes("fb.com")) return "Facebook";
  if (igshid || utm.includes("instagram") || utm === "ig" || ref === "ig" || referrer.includes("instagram.com")) return "Instagram";
  if (utm.includes("whatsapp") || utm === "wa" || ref === "wa" || referrer.includes("wa.me") || referrer.includes("whatsapp.com")) return "WhatsApp";
  if (gclid) return "Direct"; // Google Ads → Direct (not a social source)
  return "Direct";
}

function getOrCreateSessionId(): string {
  let id = sessionStorage.getItem("_pk_sid");
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem("_pk_sid", id);
  }
  return id;
}

export function getVisitorSource(): VisitorSource {
  const stored = sessionStorage.getItem("_pk_src");
  if (stored) return stored as VisitorSource;
  const detected = detectSource();
  sessionStorage.setItem("_pk_src", detected);
  return detected;
}

let pingInterval: ReturnType<typeof setInterval> | null = null;

export function startVisitorPing(): void {
  if (pingInterval) return; // already running
  const source = getVisitorSource();
  const sessionId = getOrCreateSessionId();

  const ping = () => {
    fetch("/api/track/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, source }),
      keepalive: true,
    }).catch(() => {});
  };

  ping(); // immediate ping on load
  pingInterval = setInterval(ping, 30_000); // then every 30 s
}

export function stopVisitorPing(): void {
  if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
}
