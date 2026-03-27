/* Visitor source detection + live ping beacon */

export type VisitorSource = "Facebook" | "Instagram" | "WhatsApp" | "Direct";

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
