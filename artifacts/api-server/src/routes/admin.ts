import { Router, type IRouter } from "express";
import { db, ordersTable, adminDownloadsTable, abandonedCartsTable, appSettingsTable } from "@workspace/db";
import { eq, desc, like, and, gte, lte, sql, or, inArray } from "drizzle-orm";
import { requireAdmin, requireSuperAdmin, signAdminToken, type AdminRole } from "../middlewares/requireAdmin";
import { getSettings, saveSettingsBatch, getSetting } from "./settings";
import crypto from "crypto";

const router: IRouter = Router();

const ADMIN_USERNAME = process.env["ADMIN_USERNAME"] ?? "admin";
const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"] ?? "Admin@2026";

interface StaffUser { id: string; username: string; passwordHash: string; role: AdminRole; createdAt: string; }

function hashPassword(pw: string): string {
  return crypto.createHash("sha256").update(pw + "prakriti_salt_2026").digest("hex");
}

async function getStaffUsers(): Promise<StaffUser[]> {
  try {
    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "staff_users"));
    if (!row) return [];
    return JSON.parse(row.value) as StaffUser[];
  } catch { return []; }
}

async function saveStaffUsers(users: StaffUser[]): Promise<void> {
  await saveSettingsBatch({ staff_users: JSON.stringify(users) });
}

/* ─── Auth ─── */
router.post("/admin/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  /* Current password version (for session-kill support) */
  let pwv = 0;
  try {
    const v = await getSetting("admin_password_version");
    pwv = v ? parseInt(v, 10) : 0;
  } catch { /* ignore */ }

  /* Super admin check: prefer DB-stored hash, fall back to env var */
  if (username === ADMIN_USERNAME) {
    const storedHash = await getSetting("admin_password_hash").catch(() => null);
    const inputHash = hashPassword(password ?? "");
    const validByHash = storedHash ? storedHash === inputHash : false;
    const validByEnv = !storedHash && password === ADMIN_PASSWORD;
    if (validByHash || validByEnv) {
      res.json({ token: signAdminToken(username, "super_admin", pwv), username, role: "super_admin" });
      return;
    }
  }

  /* Staff user check (stored in app_settings) */
  try {
    const staffUsers = await getStaffUsers();
    const hash = hashPassword(password ?? "");
    const found = staffUsers.find((u) => u.username === username && u.passwordHash === hash);
    if (found) {
      res.json({ token: signAdminToken(found.username, found.role, pwv), username: found.username, role: found.role });
      return;
    }
  } catch { /* ignore lookup errors */ }

  res.status(401).json({ error: "Invalid credentials" });
});

/* ─── Staff Management ─── */
router.get("/admin/staff", requireSuperAdmin, async (_req, res) => {
  try {
    const users = await getStaffUsers();
    res.json({ staff: users.map(({ id, username, role, createdAt }) => ({ id, username, role, createdAt })) });
  } catch { res.status(500).json({ error: "Failed to load staff" }); }
});

router.post("/admin/staff", requireSuperAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body as { username?: string; password?: string; role?: string };
    if (!username || !password || !role) { res.status(400).json({ error: "username, password and role are required" }); return; }
    if (!["order_manager", "view_only"].includes(role)) { res.status(400).json({ error: "role must be order_manager or view_only" }); return; }
    if (username === ADMIN_USERNAME) { res.status(400).json({ error: "Username already taken" }); return; }

    const users = await getStaffUsers();
    if (users.find((u) => u.username === username)) { res.status(400).json({ error: "Username already taken" }); return; }

    const newUser: StaffUser = {
      id: crypto.randomUUID(),
      username,
      passwordHash: hashPassword(password),
      role: role as AdminRole,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    await saveStaffUsers(users);
    res.status(201).json({ staff: { id: newUser.id, username: newUser.username, role: newUser.role, createdAt: newUser.createdAt } });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to create staff user" }); }
});

router.delete("/admin/staff/:id", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const users = await getStaffUsers();
    const filtered = users.filter((u) => u.id !== id);
    if (filtered.length === users.length) { res.status(404).json({ error: "Staff user not found" }); return; }
    await saveStaffUsers(filtered);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete staff user" }); }
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
      /* Use Drizzle inArray to avoid the PostgreSQL ANY() array syntax issue */
      const rep = await db.select({ phone: ordersTable.phone })
        .from(ordersTable)
        .where(inArray(ordersTable.phone, phoneList))
        .groupBy(ordersTable.phone)
        .having(sql`COUNT(*) > 1`);
      rep.forEach((r) => repeatPhones.add(r.phone));
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

/* ─── Shadowfax ─── */
async function checkShadowfaxServiceability(clientId: string, token: string, pincode: string): Promise<{ serviceable: boolean; zone?: string }> {
  const url = `https://api.shadowfax.in/api/serviceability/?client_id=${encodeURIComponent(clientId)}&pincode=${encodeURIComponent(pincode)}&token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { headers: { "Authorization": `Token ${token}` } });
  if (!res.ok) return { serviceable: false };
  const data = await res.json() as { status?: boolean; results?: { serviceable?: boolean; zone?: string }[] };
  const first = data.results?.[0];
  return { serviceable: first?.serviceable ?? data.status ?? false, zone: first?.zone };
}

router.post("/admin/orders/:id/ship-shadowfax", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    const settings = await getSettings([
      "shadowfax_client_id", "shadowfax_api_token", "shadowfax_store_id",
      "shadowfax_pickup_pincode", "shadowfax_pickup_address", "shadowfax_pickup_contact",
    ]);

    const clientId = process.env["SHADOWFAX_CLIENT_ID"] ?? settings["shadowfax_client_id"];
    const apiToken = process.env["SHADOWFAX_API_TOKEN"] ?? settings["shadowfax_api_token"];
    const storeId = process.env["SHADOWFAX_STORE_ID"] ?? settings["shadowfax_store_id"];

    if (!clientId || !apiToken) {
      res.status(503).json({ error: "Shadowfax credentials not configured. Add them in Settings → Shadowfax Integration." });
      return;
    }

    const serviceability = await checkShadowfaxServiceability(clientId, apiToken, order.pincode);
    if (!serviceability.serviceable) {
      res.status(422).json({
        error: `Pincode ${order.pincode} is NOT serviceable by Shadowfax.`,
        pincode: order.pincode,
        serviceable: false,
      });
      return;
    }

    const cleanPhone = order.phone.replace(/\D/g, "").slice(-10);
    const pickupContact = settings["shadowfax_pickup_contact"] ?? "8968122246";
    const pickupPincode = settings["shadowfax_pickup_pincode"] ?? "302001";
    const pickupAddress = settings["shadowfax_pickup_address"] ?? "Prakriti Herbs, Jaipur, Rajasthan";

    const createRes = await fetch("https://api.shadowfax.in/api/order/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${apiToken}`,
      },
      body: JSON.stringify({
        order_meta: {
          client_order_id: order.orderId,
          products: [{
            name: "KamaSutra Gold+ (Ayurvedic Supplement)",
            quantity: order.quantity,
            price: 999 * order.quantity,
          }],
        },
        deliver_details: {
          name: order.name,
          contact: cleanPhone,
          address: order.address,
          pincode: order.pincode,
          city: "",
        },
        pickup_details: {
          name: "Prakriti Herbs Pvt Ltd",
          contact: pickupContact,
          address: pickupAddress,
          pincode: pickupPincode,
        },
        payment_mode: order.paymentStatus === "success" ? "PREPAID" : "COD",
        cod_amount: order.paymentStatus === "success" ? 0 : 999 * order.quantity,
        weight: 300 * order.quantity,
        client_id: clientId,
        ...(storeId ? { store_id: storeId } : {}),
      }),
    });

    const createData = await createRes.json() as {
      tracking_id?: string; awb?: string; sfx_order_id?: string;
      message?: string; errors?: unknown; status?: string;
    };

    if (!createRes.ok || (!createData.tracking_id && !createData.awb)) {
      const errMsg = createData.message ?? JSON.stringify(createData.errors ?? createData);
      res.status(createRes.status).json({ error: `Shadowfax error: ${errMsg}` });
      return;
    }

    const awb = createData.tracking_id ?? createData.awb ?? `SFX-${order.orderId}`;
    const labelUrl = `https://api.shadowfax.in/api/order/label/?awb=${awb}&token=${apiToken}`;
    const trackingUrl = `https://shadowfax.in/track-your-order/?awb=${awb}`;

    await db.update(ordersTable).set({
      trackingId: awb,
      courier: "Shadowfax",
      status: "Shipped",
    }).where(eq(ordersTable.id, id));

    res.json({ awb, courier: "Shadowfax", trackingUrl, labelUrl, zone: serviceability.zone });
  } catch (err) {
    req.log.error({ err }, "Shadowfax error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Shadowfax shipping failed" });
  }
});

router.get("/admin/orders/:id/shadowfax-label", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [order] = await db.select({ trackingId: ordersTable.trackingId, courier: ordersTable.courier }).from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order?.trackingId || order.courier !== "Shadowfax") {
      res.status(404).json({ error: "No Shadowfax shipment found for this order" });
      return;
    }
    const settings = await getSettings(["shadowfax_api_token"]);
    const apiToken = process.env["SHADOWFAX_API_TOKEN"] ?? settings["shadowfax_api_token"];
    if (!apiToken) { res.status(503).json({ error: "Shadowfax token not configured" }); return; }
    const labelUrl = `https://api.shadowfax.in/api/order/label/?awb=${order.trackingId}&token=${apiToken}`;
    res.json({ labelUrl, awb: order.trackingId });
  } catch (err) {
    res.status(500).json({ error: "Failed to get label URL" });
  }
});

router.get("/admin/shadowfax/serviceability/:pincode", requireAdmin, async (req, res) => {
  try {
    const { pincode } = req.params;
    const settings = await getSettings(["shadowfax_client_id", "shadowfax_api_token"]);
    const clientId = process.env["SHADOWFAX_CLIENT_ID"] ?? settings["shadowfax_client_id"];
    const apiToken = process.env["SHADOWFAX_API_TOKEN"] ?? settings["shadowfax_api_token"];
    if (!clientId || !apiToken) { res.status(503).json({ error: "Shadowfax not configured" }); return; }
    const result = await checkShadowfaxServiceability(clientId, apiToken, pincode);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Serviceability check failed" });
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

/* ── Convert abandoned cart → order ─────────────────────────────────────── */
router.post("/admin/abandoned-carts/:id/recover", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [cart] = await db.select().from(abandonedCartsTable).where(eq(abandonedCartsTable.id, id)).limit(1);
    if (!cart) { res.status(404).json({ error: "Abandoned cart not found" }); return; }

    const orderId = `REC-${Date.now()}`;
    const [order] = await db.insert(ordersTable).values({
      orderId,
      name: cart.name,
      phone: cart.phone,
      address: cart.address ?? "To be confirmed",
      pincode: cart.pincode ?? "000000",
      quantity: 1,
      product: "KamaSutra Gold+ (1 Bottle)",
      source: "COD",
      status: "New",
      paymentMethod: "COD",
      visitorSource: "Recovered",
    }).returning();

    await db.update(abandonedCartsTable).set({ recoveryStatus: "Recovered", updatedAt: new Date() }).where(eq(abandonedCartsTable.id, id));
    res.json({ ok: true, order });
  } catch (err) {
    req.log.error({ err }, "Failed to recover abandoned cart");
    res.status(500).json({ error: "Failed to recover cart" });
  }
});

export default router;
