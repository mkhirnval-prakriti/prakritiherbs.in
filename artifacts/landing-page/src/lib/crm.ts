const CRM_POST_URL = "https://YOUR-CRM-API-LINK-HERE";
const CRM_GET_URL  = "https://YOUR-CRM-API-LINK-HERE";

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

export async function checkDuplicate(number: string): Promise<boolean> {
  try {
    const res = await fetch(`${CRM_GET_URL}?number=${number}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.some((entry: { number?: string }) => entry.number === number);
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
  number: string;
}): Promise<boolean> {
  const payload = {
    name:          fields.name,
    address:       fields.address,
    pincode:       cleanPincode(fields.pincode),
    number:        fields.number,
    reason:        "New",
    status:        "New",
    websiteSource: "ind Store",
  };
  const res = await fetch(CRM_POST_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`CRM responded with status ${res.status}`);
  return true;
}
