export const CRM_POST_URL =
  "https://webhook.site/b5b0e2d9-6248-4af8-a4b5-810f25691f6e";

const MAX_RETRIES    = 2;
const RETRY_DELAY_MS = 800;
const LS_BACKUP_KEY  = "crm_failed_leads";

export function cleanMobile(raw: string): string | null {
  let num = raw.replace(/\D/g, "");
  if (num.startsWith("91") && num.length === 12) num = num.slice(2);
  if (num.startsWith("0")  && num.length === 11) num = num.slice(1);
  return num.length === 10 ? num : null;
}

export function cleanPincode(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 6 ? digits : "111111";
}

export function getISTTimestamp(): string {
  const now   = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const ist   = new Date(istMs);
  const pad   = (n: number) => String(n).padStart(2, "0");
  return (
    `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ` +
    `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())} +0530`
  );
}

function saveLeadToLocalStorage(payload: object): void {
  try {
    const existing = JSON.parse(localStorage.getItem(LS_BACKUP_KEY) ?? "[]");
    existing.push({ ...payload, savedAt: new Date().toISOString() });
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(existing));
    console.warn("[CRM] Lead saved to localStorage backup:", payload);
  } catch (lsErr) {
    console.error("[CRM] localStorage backup failed:", lsErr);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptCRM(payload: object): Promise<void> {
  const body = JSON.stringify(payload);

  console.log("[CRM] Sending POST →", CRM_POST_URL);
  console.log("[CRM] Payload:", JSON.parse(body));

  const res = await fetch(CRM_POST_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  let responseData: unknown;
  try {
    responseData = await res.clone().json();
  } catch {
    responseData = await res.text().catch(() => "(unreadable)");
  }

  console.log("[CRM] Response status:", res.status);
  console.log("[CRM] Response body:", responseData);

  if (!res.ok) {
    const apiMsg =
      responseData !== null &&
      typeof responseData === "object" &&
      "message" in (responseData as object) &&
      typeof (responseData as { message: unknown }).message === "string"
        ? (responseData as { message: string }).message
        : typeof responseData === "object" &&
          responseData !== null &&
          "error" in (responseData as object) &&
          typeof (responseData as { error: unknown }).error === "string"
          ? (responseData as { error: string }).error
          : `API error ${res.status}: ${res.statusText}`;
    console.error("[CRM] Non-2xx response:", apiMsg);
    throw new Error(apiMsg);
  }
}

export interface CRMFields {
  name:    string;
  address: string;
  pincode: string;
  mobile:  string;
}

export async function sendLeadToCRM(fields: CRMFields): Promise<void> {
  const payload = {
    name:          fields.name,
    address:       fields.address,
    pincode:       cleanPincode(fields.pincode),
    mobile:        fields.mobile,
    reason:        "New",
    status:        "New",
    websiteSource: "ind Store",
    date:          getISTTimestamp(),
  };

  console.log("[CRM] Submitting form — building payload…");

  let lastError: Error = new Error("Unknown CRM error");

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      await attemptCRM(payload);
      console.log(`[CRM] Success on attempt ${attempt}`);
      return;
    } catch (err) {
      lastError = err as Error;
      console.error(`[CRM] Attempt ${attempt}/${MAX_RETRIES + 1} failed:`, lastError.message);

      if (attempt <= MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt;
        console.log(`[CRM] Retrying in ${delay}ms…`);
        await sleep(delay);
      }
    }
  }

  console.error("[CRM] All retries exhausted. Saving to backup.");
  saveLeadToLocalStorage(payload);
  throw lastError;
}
