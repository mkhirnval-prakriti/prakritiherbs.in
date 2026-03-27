import { Router, type IRouter } from "express";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

/* In-memory visitor registry — sessionId → { source, lastPing } */
interface VisitorEntry { source: string; lastPing: number; }
const visitors = new Map<string, VisitorEntry>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes — inactive after this

function cleanup() {
  const cutoff = Date.now() - TTL_MS;
  for (const [key, val] of visitors.entries()) {
    if (val.lastPing < cutoff) visitors.delete(key);
  }
}

function normalizeSource(raw: string | undefined): string {
  if (!raw) return "Direct";
  const s = raw.toLowerCase();
  if (s.includes("facebook") || s === "fb") return "Facebook";
  if (s.includes("instagram") || s === "ig") return "Instagram";
  if (s.includes("whatsapp") || s === "wa") return "WhatsApp";
  if (s === "direct") return "Direct";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/* Public — no auth required. Called every 30 s from the landing page. */
router.post("/track/ping", (req, res) => {
  const body = req.body as { sessionId?: string; source?: string };
  const sessionId = typeof body.sessionId === "string" && body.sessionId.length > 0
    ? body.sessionId : `anon-${Math.random().toString(36).slice(2)}`;
  cleanup();
  visitors.set(sessionId, { source: normalizeSource(body.source), lastPing: Date.now() });
  res.json({ ok: true });
});

/* Admin only — returns live count + per-source breakdown */
router.get("/admin/live-visitors", requireAdmin, (_req, res) => {
  cleanup();
  const breakdown: Record<string, number> = {};
  for (const val of visitors.values()) {
    breakdown[val.source] = (breakdown[val.source] ?? 0) + 1;
  }
  const ordered = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  res.json({ total: visitors.size, breakdown: Object.fromEntries(ordered) });
});

export default router;
