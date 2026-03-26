export const CRM_POST_URL = "https://your-real-api.com/endpoint";

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
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const ist   = new Date(istMs);
  const pad   = (n: number) => String(n).padStart(2, "0");
  return (
    `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ` +
    `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())} +0530`
  );
}

export async function sendLeadToCRM(fields: {
  name: string;
  address: string;
  pincode: string;
  mobile: string;
}): Promise<void> {
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

  const res = await fetch(CRM_POST_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`CRM API error: ${res.status} ${res.statusText}`);
  }
}
