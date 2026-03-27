/**
 * Meta Conversions API (CAPI) — server-side / CRM event delivery
 *
 * Sends events directly from the server to Meta's Graph API using
 * action_source: "system_generated" (CRM-mode), which is the correct
 * action_source when the event originates from a CRM or backend system
 * rather than a browser page-view.
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 *
 * Requires the META_ACCESS_TOKEN environment variable — a System User token
 * with "ads_management" permission, created in:
 *   Meta Business Manager → Business Settings → System Users → Generate Token
 */

import { createHash } from "crypto";

const PIXEL_ID = "1188710012812588";
const CAPI_URL = `https://graph.facebook.com/v25.0/${PIXEL_ID}/events`;

/** SHA-256 hash a string (lowercase-trimmed) as required by Meta CAPI */
function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/**
 * Normalize an Indian mobile number to E.164 digits for hashing.
 * Strips spaces/dashes, removes leading 0, prepends country code 91.
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export interface CAPIEventParams {
  /** Standard Meta event name */
  eventName: "Lead" | "Purchase" | "InitiateCheckout" | "PageView";

  /**
   * Deduplication ID — MUST match the eventID passed to the browser-side
   * fbq("track", "Lead", { eventID: "..." }) call so Meta counts them as
   * one event, not two.
   */
  eventId?: string;

  /** Customer identifiers — all hashed with SHA-256 before sending */
  phone?: string;
  email?: string;
  name?: string;

  /** Browser signals forwarded from the client request */
  ipAddress?: string;
  userAgent?: string;
  fbp?: string;   // _fbp cookie (Meta's first-party browser ID)
  fbc?: string;   // _fbc cookie (click ID from Meta ads)

  /** CRM-specific identifier for the lead */
  leadId?: string;

  /**
   * Additional custom_data fields merged on top of the CRM defaults.
   * Do NOT pass event_source or lead_event_source here — they are set
   * automatically as required CRM fields.
   */
  customData?: Record<string, unknown>;
}

/**
 * Send a single event to Meta Conversions API in CRM/system mode.
 *
 * Behaviour:
 *  - Returns false and logs nothing if META_ACCESS_TOKEN is not set.
 *  - Never throws — errors are caught and logged; order flow is never blocked.
 *  - Uses action_source: "system_generated" (correct for CRM-originated events).
 *  - Omits event_source_url (only valid for action_source: "website").
 *  - Always includes custom_data.event_source and lead_event_source as
 *    required by Meta for CRM lead events.
 */
export async function sendCapiEvent(params: CAPIEventParams): Promise<boolean> {
  const token = process.env["META_ACCESS_TOKEN"];
  if (!token) {
    // CAPI is optional — client-side pixel still fires normally without this.
    // Set META_ACCESS_TOKEN in Secrets to enable server-side event delivery.
    return false;
  }

  const eventTime = Math.floor(Date.now() / 1000);

  // ── user_data: all PII must be SHA-256 hashed ────────────────────────────
  const userData: Record<string, unknown> = {
    country: [sha256("in")],
  };

  if (params.phone) {
    userData["ph"] = [sha256(normalizePhone(params.phone))];
  }

  if (params.email) {
    userData["em"] = [sha256(params.email)];
  }

  if (params.name) {
    const parts = params.name.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts[parts.length - 1] : undefined;
    if (firstName) userData["fn"] = [sha256(firstName)];
    if (lastName)  userData["ln"] = [sha256(lastName)];
  }

  // Browser-forwarded signals (not hashed — passed as-is per Meta spec)
  if (params.ipAddress) userData["client_ip_address"] = params.ipAddress;
  if (params.userAgent) userData["client_user_agent"] = params.userAgent;
  if (params.fbp)       userData["fbp"] = params.fbp;
  if (params.fbc)       userData["fbc"] = params.fbc;

  // ── custom_data: CRM required fields + caller overrides ──────────────────
  const customData: Record<string, unknown> = {
    // Required CRM identifiers per Meta's lead events specification
    event_source:       "crm",
    lead_event_source:  "Prakriti CRM",
    // Product context
    currency:           "INR",
    value:              999,
    content_name:       "KamaSutra Gold+",
    // Spread caller extras (e.g. order_id, num_items)
    ...(params.customData ?? {}),
  };

  // ── event payload ─────────────────────────────────────────────────────────
  const eventPayload: Record<string, unknown> = {
    event_name:    params.eventName,
    event_time:    eventTime,
    action_source: "system_generated",   // CRM / backend origin
    // event_source_url is intentionally omitted — only valid for "website"
    user_data:     userData,
    custom_data:   customData,
  };

  if (params.eventId) eventPayload["event_id"] = params.eventId;
  if (params.leadId)  eventPayload["lead_id"]  = params.leadId;

  const requestBody = {
    data:         [eventPayload],
    access_token: token,
  };

  try {
    const response = await fetch(CAPI_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[CAPI] ${params.eventName} — HTTP ${response.status}:`, text);
      return false;
    }

    const json = (await response.json()) as { events_received?: number };
    console.log(
      `[CAPI] ${params.eventName} sent.`,
      `events_received=${json.events_received ?? "?"}`,
      params.eventId ? `event_id=${params.eventId}` : "",
    );
    return true;
  } catch (err) {
    console.error("[CAPI] Network error:", err);
    return false;
  }
}
