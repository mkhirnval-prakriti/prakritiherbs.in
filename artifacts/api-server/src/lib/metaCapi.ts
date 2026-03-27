/**
 * Meta Conversions API (CAPI) — server-side event delivery
 *
 * Sends events directly from the server to Meta's Graph API.
 * This bypasses ad blockers, browser privacy settings, and any client-side
 * failures, guaranteeing that events reach Meta's Events Manager.
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 *
 * Requires the META_ACCESS_TOKEN environment variable (System User token
 * with ads_management permission, created in Meta Business Manager →
 * Business Settings → System Users).
 */

import { createHash } from "crypto";

const PIXEL_ID = "1188710012812588";
const CAPI_URL = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events`;

/** SHA-256 hash a string (lowercase-trimmed) as required by Meta CAPI */
function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/**
 * Normalize an Indian mobile number to E.164 format for hashing.
 * Strips spaces/dashes, removes leading 0, prepends country code 91.
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // If already 12 digits starting with 91, use as-is
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  // 10-digit Indian number → add 91
  if (digits.length === 10) return `91${digits}`;
  // 11-digit starting with 0 → replace leading 0 with 91
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export interface CAPIEventParams {
  eventName: "Lead" | "Purchase" | "InitiateCheckout" | "PageView";
  eventId?: string;           // Deduplication ID — must match client-side event
  sourceUrl?: string;
  phone?: string;
  name?: string;
  ipAddress?: string;
  userAgent?: string;
  fbp?: string;               // _fbp cookie value from client
  fbc?: string;               // _fbc cookie value from client
  customData?: Record<string, unknown>;
}

/**
 * Send a single event to Meta Conversions API.
 * Silently logs and returns false if META_ACCESS_TOKEN is not set.
 * Never throws — CAPI errors must never break the order flow.
 */
export async function sendCapiEvent(params: CAPIEventParams): Promise<boolean> {
  const token = process.env["META_ACCESS_TOKEN"];
  if (!token) {
    // Not configured — skip silently. Set META_ACCESS_TOKEN to enable.
    return false;
  }

  const eventTime = Math.floor(Date.now() / 1000);

  const userData: Record<string, unknown> = {
    country: [sha256("in")],
  };

  if (params.phone) {
    userData["ph"] = [sha256(normalizePhone(params.phone))];
  }

  if (params.name) {
    // Use first word as first name
    const firstName = params.name.trim().split(/\s+/)[0];
    if (firstName) userData["fn"] = [sha256(firstName)];
  }

  if (params.ipAddress) {
    userData["client_ip_address"] = params.ipAddress;
  }

  if (params.userAgent) {
    userData["client_user_agent"] = params.userAgent;
  }

  if (params.fbp) {
    userData["fbp"] = params.fbp;
  }

  if (params.fbc) {
    userData["fbc"] = params.fbc;
  }

  const eventPayload: Record<string, unknown> = {
    event_name: params.eventName,
    event_time: eventTime,
    action_source: "website",
    event_source_url: params.sourceUrl ?? "https://prakritiherbs.in/",
    user_data: userData,
  };

  if (params.eventId) {
    eventPayload["event_id"] = params.eventId;
  }

  if (params.customData) {
    eventPayload["custom_data"] = params.customData;
  }

  const body = {
    data: [eventPayload],
    access_token: token,
  };

  try {
    const response = await fetch(CAPI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[CAPI] Error ${response.status}:`, text);
      return false;
    }

    const json = (await response.json()) as { events_received?: number };
    console.log(`[CAPI] ${params.eventName} sent. events_received=${json.events_received ?? "?"}`);
    return true;
  } catch (err) {
    console.error("[CAPI] Network error:", err);
    return false;
  }
}
