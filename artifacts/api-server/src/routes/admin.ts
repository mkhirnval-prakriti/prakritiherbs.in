import { Router, type IRouter } from "express";
import { db, ordersTable, adminDownloadsTable, abandonedCartsTable } from "@workspace/db";
import { eq, desc, like, and, gte, lte, sql, or, inArray } from "drizzle-orm";
import { requireAdmin, signAdminToken } from "../middlewares/requireAdmin";
import { getSettings } from "./settings";

const router: IRouter = Router();

const ADMIN_USERNAME = process.env["ADMIN_USERNAME"] ?? "admin";
const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"] ?? "Admin@2026";

/* ─── Auth ─── */
router.post("/admin/login", (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    res.json({ token: signAdminToken(username), username });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

/* ─── Orders ─── */
router.get("/admin/orders", requireAdmin, async (req, res) => {
  try {
    const { search, status, dateFrom, dateTo, page = "1", limit = "50" } = req.query as Record<string, string>;
    const conditions = [];
    if (search) conditions.push(or(like(ordersTable.name, `%${search}%`), like(ordersTable.phone, `%${search}%`), like(ordersTable.address, `%${search}%`)));
    if (status && status !== "all") conditions.push(eq(ordersTable.status, status));
    if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)));
    if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); conditions.push(lte(ordersTable.createdAt, end)); }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [orders, countResult] = await Promise.all([
      db.select().from(ordersTable).where(where).orderBy(desc(ordersTable.createdAt)).limit(limitNum).offset((pageNum - 1) * limitNum),
      db.select({ count: sql<number>`COUNT(*)` }).from(ordersTable).where(where),
    ]);

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const [statsResult] = await db.select({
      total: sql<number>`COUNT(*)`,
      todayCount: sql<number>`COUNT(*) FILTER (WHERE created_at >= ${todayStart})`,
      newCount: sql<number>`COUNT(*) FILTER (WHERE status = 'New')`,
      confirmedCount: sql<number>`COUNT(*) FILTER (WHERE status = 'Confirmed')`,
      shippedCount: sql<number>`COUNT(*) FILTER (WHERE status = 'Shipped')`,
      cancelledCount: sql<number>`COUNT(*) FILTER (WHERE status = 'Cancelled')`,
      deliveredCount: sql<number>`COUNT(*) FILTER (WHERE status = 'Delivered')`,
    }).from(ordersTable);

    const phoneList = orders.map((o) => o.phone);
    let repeatPhones = new Set<string>();
    if (phoneList.length > 0) {
      const rep = await db.execute(sql`SELECT phone FROM orders WHERE phone = ANY(${phoneList}) GROUP BY phone HAVING COUNT(*) > 1`);
      rep.rows.forEach((r) => { const row = r as Record<string, unknown>; repeatPhones.add(String(row["phone"] ?? "")); });
    }

    const enrichedOrders = orders.map((o) => ({ ...o, isRepeat: repeatPhones.has(o.phone) }));

    res.json({
      orders: enrichedOrders,
      total: Number(countResult[0]?.count ?? 0), page: pageNum, limit: limitNum,
      stats: {
        total: Number(statsResult?.total ?? 0), today: Number(statsResult?.todayCount ?? 0),
        new: Number(statsResult?.newCount ?? 0), confirmed: Number(statsResult?.confirmedCount ?? 0),
        shipped: Number(statsResult?.shippedCount ?? 0), cancelled: Number(statsResult?.cancelledCount ?? 0),
        delivered: Number(statsResult?.deliveredCount ?? 0),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch admin orders");
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.patch("/admin/orders/:id/status", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body as { status?: string };
    const validStatuses = ["New", "Confirmed", "Shipped", "Cancelled", "Delivered"];
    if (!status || !validStatuses.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
    const [updated] = await db.update(ordersTable).set({ status }).where(eq(ordersTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Order not found" }); return; }

    if (status === "Confirmed") void sendWhatsAppOrderConfirmed(updated);
    res.json({ order: updated });
  } catch (err) {
    req.log.error({ err }, "Failed to update order status");
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.post("/admin/orders/bulk-status", requireAdmin, async (req, res) => {
  try {
    const { ids, status } = req.body as { ids?: number[]; status?: string };
    const validStatuses = ["New", "Confirmed", "Shipped", "Cancelled", "Delivered"];
    if (!status || !validStatuses.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
    if (!ids || !Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "ids required" }); return; }
    const updated = await db.update(ordersTable).set({ status }).where(inArray(ordersTable.id, ids)).returning({ id: ordersTable.id });
    res.json({ updated: updated.length, status });
  } catch (err) {
    req.log.error({ err }, "Bulk status failed");
    res.status(500).json({ error: "Bulk update failed" });
  }
});

/* ─── Shiprocket ─── */
async function getShiprocketToken(): Promise<string> {
  const settings = await getSettings(["shiprocket_email", "shiprocket_password"]);
  const email = process.env["SHIPROCKET_EMAIL"] ?? settings["shiprocket_email"];
  const password = process.env["SHIPROCKET_PASSWORD"] ?? settings["shiprocket_password"];
  if (!email || !password) throw new Error("Shiprocket credentials not configured");

  const res = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Shiprocket login failed");
  const data = await res.json() as { token?: string; message?: string };
  if (!data.token) throw new Error(data.message ?? "Shiprocket login failed");
  return data.token;
}

router.post("/admin/orders/:id/ship-shiprocket", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    const token = await getShiprocketToken();

    const istDate = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const dateObj = new Date(istDate);
    const orderDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")} ${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;

    const createRes = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        order_id: order.orderId,
        order_date: orderDate,
        pickup_location: "Primary",
        billing_customer_name: order.name,
        billing_last_name: "",
        billing_address: order.address,
        billing_city: "India",
        billing_pincode: order.pincode,
        billing_state: "India",
        billing_country: "India",
        billing_email: "customer@prakritiherbs.in",
        billing_phone: order.phone,
        shipping_is_billing: true,
        order_items: [{
          name: "KamaSutra Gold+ (Ayurvedic Supplement)",
          sku: "KSGOLD001",
          units: order.quantity,
          selling_price: 999,
          hsn: 3004,
        }],
        payment_method: order.paymentMethod === "COD" ? "COD" : "Prepaid",
        sub_total: 999 * order.quantity,
        length: 15, breadth: 12, height: 5, weight: 0.3,
      }),
    });

    const createData = await createRes.json() as { order_id?: number; shipment_id?: number; message?: string };
    if (!createRes.ok) throw new Error(createData.message ?? "Shiprocket order creation failed");

    const awbRes = await fetch("https://apiv2.shiprocket.in/v1/external/courier/generate/awb", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ shipment_id: createData.shipment_id }),
    });

    const awbData = await awbRes.json() as { response?: { data?: { awb_code?: string; courier_name?: string } } };
    const awb = awbData.response?.data?.awb_code ?? `SR-${order.orderId}`;
    const courierName = awbData.response?.data?.courier_name ?? "Shiprocket";

    await db.update(ordersTable).set({
      trackingId: awb,
      courier: courierName,
      status: "Shipped",
    }).where(eq(ordersTable.id, id));

    res.json({ awb, courier: courierName, trackingUrl: `https://shiprocket.co/tracking/${awb}`, shiprocketOrderId: createData.order_id });
  } catch (err) {
    req.log.error({ err }, "Shiprocket error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Shiprocket failed" });
  }
});

router.post("/admin/orders/:id/ship-indiapost", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { trackingId } = req.body as { trackingId?: string };
    if (!trackingId) { res.status(400).json({ error: "trackingId required" }); return; }

    await db.update(ordersTable).set({
      trackingId,
      courier: "India Post",
      status: "Shipped",
    }).where(eq(ordersTable.id, id));

    res.json({ trackingUrl: `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`, trackingId });
  } catch (err) {
    req.log.error({ err }, "India Post tracking failed");
    res.status(500).json({ error: "Failed to update tracking" });
  }
});

/* ─── WhatsApp ─── */
async function sendWhatsAppMsg(phone: string, message: string): Promise<void> {
  const settings = await getSettings(["whatsapp_api_url", "whatsapp_api_key", "whatsapp_provider"]);
  const apiUrl = process.env["WHATSAPP_API_URL"] ?? settings["whatsapp_api_url"];
  const apiKey = process.env["WHATSAPP_API_KEY"] ?? settings["whatsapp_api_key"];
  if (!apiUrl || !apiKey) return;

  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  const fullPhone = `91${cleanPhone}`;

  await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ phone: fullPhone, message, to: fullPhone }),
  });
}

async function sendWhatsAppOrderConfirmed(order: { name: string; phone: string; orderId: string; quantity: number }) {
  const settings = await getSettings(["whatsapp_template_order_confirmed"]);
  const template = settings["whatsapp_template_order_confirmed"]
    ?? `नमस्ते {{name}} जी! आपका KamaSutra Gold+ ऑर्डर Confirm हो गया है। Order ID: {{orderId}}। हम जल्द ही आपके पते पर भेज देंगे। - Prakriti Herbs`;

  const msg = template
    .replace(/\{\{name\}\}/g, order.name)
    .replace(/\{\{orderId\}\}/g, order.orderId)
    .replace(/\{\{quantity\}\}/g, String(order.quantity))
    .replace(/\{\{amount\}\}/g, String(999 * order.quantity));

  await sendWhatsAppMsg(order.phone, msg).catch(() => {});
}

router.post("/admin/orders/:id/whatsapp", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { message } = req.body as { message?: string };
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    const settings = await getSettings(["whatsapp_api_url", "whatsapp_api_key"]);
    const apiUrl = process.env["WHATSAPP_API_URL"] ?? settings["whatsapp_api_url"];
    if (!apiUrl) {
      res.status(503).json({ error: "WhatsApp not configured. Add credentials in Settings." });
      return;
    }

    const msg = message ?? `नमस्ते ${order.name} जी! आपका ऑर्डर (#${order.orderId}) ${order.status} है। - Prakriti Herbs`;
    await sendWhatsAppMsg(order.phone, msg);
    res.json({ ok: true, phone: order.phone });
  } catch (err) {
    req.log.error({ err }, "WhatsApp failed");
    res.status(500).json({ error: "WhatsApp send failed" });
  }
});

router.post("/admin/abandoned-carts/:id/whatsapp", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [cart] = await db.select().from(abandonedCartsTable).where(eq(abandonedCartsTable.id, id)).limit(1);
    if (!cart) { res.status(404).json({ error: "Cart not found" }); return; }

    const settings = await getSettings(["whatsapp_api_url", "whatsapp_api_key", "whatsapp_template_abandoned_cart"]);
    const apiUrl = process.env["WHATSAPP_API_URL"] ?? settings["whatsapp_api_url"];
    if (!apiUrl) {
      res.status(503).json({ error: "WhatsApp not configured" });
      return;
    }

    const template = settings["whatsapp_template_abandoned_cart"]
      ?? `नमस्ते {{name}} जी! आपने KamaSutra Gold+ का ऑर्डर पूरा नहीं किया। अभी ₹999 में ऑर्डर करें और FREE डिलीवरी पाएं! prakritiherbs.in`;

    const msg = template.replace(/\{\{name\}\}/g, cart.name);
    await sendWhatsAppMsg(cart.phone, msg);
    await db.update(abandonedCartsTable).set({ recoveryStatus: "Called", updatedAt: new Date() }).where(eq(abandonedCartsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Cart WhatsApp failed");
    res.status(500).json({ error: "WhatsApp send failed" });
  }
});

/* ─── Downloads ─── */
router.post("/admin/downloads", requireAdmin, async (req, res) => {
  try {
    const { filename, recordCount, filters } = req.body as { filename?: string; recordCount?: number; filters?: string };
    const [record] = await db.insert(adminDownloadsTable).values({
      downloadedBy: "admin",
      filename: filename ?? "orders_export.csv",
      recordCount: recordCount ?? 0,
      filters: filters ?? null,
    }).returning();
    res.status(201).json({ download: record });
  } catch { res.status(500).json({ error: "Failed to log download" }); }
});

router.get("/admin/downloads", requireAdmin, async (req, res) => {
  try {
    const downloads = await db.select().from(adminDownloadsTable).orderBy(desc(adminDownloadsTable.downloadedAt)).limit(100);
    res.json({ downloads });
  } catch { res.status(500).json({ error: "Failed to fetch downloads" }); }
});

/* ─── Abandoned Carts ─── */
router.post("/abandoned-cart", async (req, res) => {
  try {
    const { name, phone, address, pincode, source, eventId } = req.body as { name?: string; phone?: string; address?: string; pincode?: string; source?: string; eventId?: string };
    if (!name || !phone) { res.status(400).json({ error: "name and phone required" }); return; }
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const existing = await db.select({ id: abandonedCartsTable.id }).from(abandonedCartsTable).where(eq(abandonedCartsTable.phone, cleanPhone)).limit(1);
    if (existing.length > 0) { res.status(200).json({ ok: true, exists: true }); return; }
    await db.insert(abandonedCartsTable).values({ name: name.trim(), phone: cleanPhone, address: address?.trim() ?? null, pincode: pincode?.trim() ?? null, source: source ?? "COD", eventId: eventId ?? null, recoveryStatus: "New" });
    res.status(201).json({ ok: true });
  } catch { res.status(200).json({ ok: false }); }
});

router.get("/admin/abandoned-carts", requireAdmin, async (req, res) => {
  try {
    const { search, status, page = "1", limit = "50" } = req.query as Record<string, string>;
    const conditions = [];
    if (search) conditions.push(or(like(abandonedCartsTable.name, `%${search}%`), like(abandonedCartsTable.phone, `%${search}%`)));
    if (status && status !== "all") conditions.push(eq(abandonedCartsTable.recoveryStatus, status));
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, parseInt(limit, 10));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [carts, countResult] = await Promise.all([
      db.select().from(abandonedCartsTable).where(where).orderBy(desc(abandonedCartsTable.createdAt)).limit(limitNum).offset((pageNum - 1) * limitNum),
      db.select({ count: sql<number>`COUNT(*)` }).from(abandonedCartsTable).where(where),
    ]);
    res.json({ carts, total: Number(countResult[0]?.count ?? 0), page: pageNum });
  } catch { res.status(500).json({ error: "Failed to fetch abandoned carts" }); }
});

router.patch("/admin/abandoned-carts/:id/status", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body as { status?: string };
    const validStatuses = ["New", "Called", "Follow-up", "Recovered", "Not Interested"];
    if (!status || !validStatuses.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
    const [updated] = await db.update(abandonedCartsTable).set({ recoveryStatus: status, updatedAt: new Date() }).where(eq(abandonedCartsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ cart: updated });
  } catch { res.status(500).json({ error: "Failed to update" }); }
});

export default router;
