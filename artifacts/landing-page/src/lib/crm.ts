export const CRM_POST_URL =
  "https://crm.prakritiherbs.com/";

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

  try {
    await fetch(CRM_POST_URL, {
      method:  "POST",
      mode:    "no-cors",
      headers: { "Content-Type": "text/plain" },
      body,
    });
  } catch (networkErr) {
    console.error("[CRM] Network error (fetch failed):", networkErr);
    throw networkErr;
  }

  console.log("[CRM] Request sent successfully");
}

export interface CRMFields {
  name:    string;
  address: string;
  pincode: string;
  number:  string;
}

export async function sendLeadToCRM(fields: CRMFields): Promise<void> {
  const payload = {
    name:          fields.name,
    address:       fields.address,
    pincode:       cleanPincode(fields.pincode),
    number:        fields.number,
    reason:        "New",
    status:        "New",
    websiteSource: "ind Store",
  };

  console.log("[CRM] Payload to be sent:", JSON.stringify(payload, null, 2));

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
