const CRM_POST_URL = "https://YOUR-CRM-API-ENDPOINT";
const CRM_GET_URL  = "https://YOUR-CRM-GET-ENDPOINT";

export function cleanMobile(raw: string): string | null {
  let num = raw.replace(/\D/g, "");
  if (num.startsWith("91") && num.length === 12) num = num.slice(2);
  if (num.startsWith("0")  && num.length === 11) num = num.slice(1);
  return num.length === 10 ? num : null;
}

export async function checkDuplicate(mobile: string): Promise<boolean> {
  try {
    const res = await fetch(`${CRM_GET_URL}?number=${mobile}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.some((entry: { number?: string }) => entry.number === mobile);
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
  try {
    const res = await fetch(CRM_POST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:          fields.name,
        address:       fields.address,
        pincode:       fields.pincode,
        number:        fields.number,
        reason:        "New",
        status:        "New",
        websiteSource: "ind Store",
      }),
    });
    if (!res.ok) throw new Error(`CRM responded with ${res.status}`);
    return true;
  } catch (err) {
    console.error("CRM submission failed:", err);
    return false;
  }
}
