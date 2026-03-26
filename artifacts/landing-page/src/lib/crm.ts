export const CRM_POST_URL = "https://webhook.site/b5b0e2d9-6248-4af8-a4b5-810f25691f6e";

const MAX_RETRIES     = 2;
const RETRY_DELAY_MS  = 800;
const LS_BACKUP_KEY   = "crm_failed_leads";

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
    console.warn("CRM failed — lead saved to localStorage backup:", payload);
  } catch (lsErr) {
    console.error("localStorage backup also failed:", lsErr);
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptCRM(payload: object): Promise<void> {
  const res = await fetch(CRM_POST_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = `API error ${res.status}: ${res.statusText}`;
    try {
      const json = await res.json();
      if (json?.message) message = json.message;
      else if (json?.error)   message = json.error;
    } catch {
    }
    throw new Error(message);
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

  let lastError: Error = new Error("Unknown CRM error");

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      await attemptCRM(payload);
      console.log(`CRM success on attempt ${attempt}`);
      return;
    } catch (err) {
      lastError = err as Error;
      console.error(`CRM attempt ${attempt}/${MAX_RETRIES + 1} failed:`, lastError.message);

      if (attempt <= MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY_MS * attempt}ms…`);
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  saveLeadToLocalStorage(payload);
  throw lastError;
}
