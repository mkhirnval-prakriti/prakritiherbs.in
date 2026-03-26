const CRM_POST_URL = "https://YOUR-CRM-DOMAIN.com/api/lead-create";
const CRM_GET_URL  = "https://YOUR-CRM-DOMAIN.com/api/lead-list";

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

function getISTTimestamp(): string {
  const now = new Date();
  const istMs = now.getTime() + (5.5 * 60 * 60 * 1000);
  const ist = new Date(istMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ` +
    `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())} +0530`
  );
}

export async function checkDuplicate(mobile: string): Promise<boolean> {
  try {
    const res = await fetch(`${CRM_GET_URL}?mobile=${mobile}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.some((entry: { mobile?: string }) => entry.mobile === mobile);
    }
    return false;
  } catch (err) {
    console.error("CRM duplicate check failed:", err);
    return false;
  }
}

export async function sendLeadToCRM(fields: {
  name: string;
  address: string;
  pincode: string;
  mobile: string;
}): Promise<boolean> {
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
  try {
    const res = await fetch(CRM_POST_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`CRM responded with status ${res.status}`);
    return true;
  } catch (err) {
    console.error("CRM submission failed:", err);
    throw err;
  }
}
