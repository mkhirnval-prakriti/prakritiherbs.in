import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const KEY = "agency_profiles";

export interface AgencyProfile {
  id: string;
  name: string;
  sourceName: string;
  pixelId: string;
  businessManagerId: string;
  capiToken: string;
  googleAdsConversionId: string;
  googleAdsConversionLabel: string;
  ga4MeasurementId: string;
  googleSheetWebhookUrl: string;
  active: boolean;
  createdAt: string;
}

async function readAgencies(): Promise<AgencyProfile[]> {
  const { rows } = await pool.query<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = $1 LIMIT 1",
    [KEY],
  );
  if (!rows[0]) return [];
  try { return JSON.parse(rows[0].value) as AgencyProfile[]; }
  catch { return []; }
}

async function writeAgencies(profiles: AgencyProfile[]): Promise<void> {
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [KEY, JSON.stringify(profiles)],
  );
}

router.get("/admin/agencies", requireAdmin, async (_req, res) => {
  try {
    const profiles = await readAgencies();
    const masked = profiles.map((p) => ({
      ...p,
      capiToken: p.capiToken ? "••••••••" + p.capiToken.slice(-4) : "",
    }));
    res.json(masked);
  } catch {
    res.status(500).json({ error: "Failed to fetch agencies" });
  }
});

router.post("/admin/agencies", requireAdmin, async (req, res) => {
  try {
    const body = req.body as Partial<AgencyProfile> & { id?: string };
    const profiles = await readAgencies();

    if (body.id) {
      const idx = profiles.findIndex((p) => p.id === body.id);
      if (idx === -1) return res.status(404).json({ error: "Agency not found" });
      const existing = profiles[idx];
      const updated: AgencyProfile = {
        ...existing,
        name: body.name ?? existing.name,
        sourceName: body.sourceName ?? existing.sourceName,
        pixelId: body.pixelId ?? existing.pixelId,
        businessManagerId: body.businessManagerId ?? existing.businessManagerId,
        googleAdsConversionId: body.googleAdsConversionId ?? existing.googleAdsConversionId,
        googleAdsConversionLabel: body.googleAdsConversionLabel ?? existing.googleAdsConversionLabel,
        ga4MeasurementId: body.ga4MeasurementId ?? existing.ga4MeasurementId,
        googleSheetWebhookUrl: body.googleSheetWebhookUrl ?? existing.googleSheetWebhookUrl,
        active: body.active !== undefined ? body.active : existing.active,
        capiToken: (body.capiToken && !body.capiToken.startsWith("••")) ? body.capiToken : existing.capiToken,
      };
      profiles[idx] = updated;
      await writeAgencies(profiles);
      return res.json({ ...updated, capiToken: updated.capiToken ? "••••••••" + updated.capiToken.slice(-4) : "" });
    }

    const newProfile: AgencyProfile = {
      id: randomUUID(),
      name: body.name ?? "New Agency",
      sourceName: body.sourceName ?? "",
      pixelId: body.pixelId ?? "",
      businessManagerId: body.businessManagerId ?? "",
      capiToken: body.capiToken ?? "",
      googleAdsConversionId: body.googleAdsConversionId ?? "",
      googleAdsConversionLabel: body.googleAdsConversionLabel ?? "",
      ga4MeasurementId: body.ga4MeasurementId ?? "",
      googleSheetWebhookUrl: body.googleSheetWebhookUrl ?? "",
      active: body.active !== undefined ? body.active : true,
      createdAt: new Date().toISOString(),
    };
    profiles.push(newProfile);
    await writeAgencies(profiles);
    return res.status(201).json({ ...newProfile, capiToken: newProfile.capiToken ? "••••••••" + newProfile.capiToken.slice(-4) : "" });
  } catch {
    res.status(500).json({ error: "Failed to save agency" });
  }
});

router.patch("/admin/agencies/:id/toggle", requireAdmin, async (req, res) => {
  try {
    const profiles = await readAgencies();
    const idx = profiles.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Agency not found" });
    profiles[idx].active = !profiles[idx].active;
    await writeAgencies(profiles);
    res.json({ id: profiles[idx].id, active: profiles[idx].active });
  } catch {
    res.status(500).json({ error: "Failed to toggle agency" });
  }
});

router.delete("/admin/agencies/:id", requireAdmin, async (req, res) => {
  try {
    const profiles = await readAgencies();
    const filtered = profiles.filter((p) => p.id !== req.params.id);
    await writeAgencies(filtered);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete agency" });
  }
});

export { readAgencies };
export default router;
