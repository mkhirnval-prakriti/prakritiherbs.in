import { Router, type IRouter } from "express";
import { db, ordersTable, adminDownloadsTable } from "@workspace/db";
import { eq, desc, like, and, gte, lte, sql, or } from "drizzle-orm";
import { requireAdmin, signAdminToken } from "../middlewares/requireAdmin";

const router: IRouter = Router();

const ADMIN_USERNAME = process.env["ADMIN_USERNAME"] ?? "admin";
const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"] ?? "Admin@2026";

router.post("/admin/login", (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = signAdminToken(username);
    res.json({ token, username });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

router.get("/admin/orders", requireAdmin, async (req, res) => {
  try {
    const { search, status, dateFrom, dateTo, page = "1", limit = "50" } = req.query as Record<string, string>;

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          like(ordersTable.name, `%${search}%`),
          like(ordersTable.phone, `%${search}%`)
        )
      );
    }
    if (status && status !== "all") {
      conditions.push(eq(ordersTable.status, status));
    }
    if (dateFrom) {
      conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(ordersTable.createdAt, end));
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [orders, countResult] = await Promise.all([
      db
        .select()
        .from(ordersTable)
        .where(where)
        .orderBy(desc(ordersTable.createdAt))
        .limit(limitNum)
        .offset(offset),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(ordersTable)
        .where(where),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [statsResult] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        todayCount: sql<number>`COUNT(*) FILTER (WHERE created_at >= ${todayStart})`,
        newCount: sql<number>`COUNT(*) FILTER (WHERE status = 'New')`,
        confirmedCount: sql<number>`COUNT(*) FILTER (WHERE status = 'Confirmed')`,
        shippedCount: sql<number>`COUNT(*) FILTER (WHERE status = 'Shipped')`,
        cancelledCount: sql<number>`COUNT(*) FILTER (WHERE status = 'Cancelled')`,
        deliveredCount: sql<number>`COUNT(*) FILTER (WHERE status = 'Delivered')`,
      })
      .from(ordersTable);

    res.json({
      orders,
      total: Number(countResult[0]?.count ?? 0),
      page: pageNum,
      limit: limitNum,
      stats: {
        total: Number(statsResult?.total ?? 0),
        today: Number(statsResult?.todayCount ?? 0),
        new: Number(statsResult?.newCount ?? 0),
        confirmed: Number(statsResult?.confirmedCount ?? 0),
        shipped: Number(statsResult?.shippedCount ?? 0),
        cancelled: Number(statsResult?.cancelledCount ?? 0),
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

    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: `Status must be one of: ${validStatuses.join(", ")}` });
      return;
    }

    const [updated] = await db
      .update(ordersTable)
      .set({ status })
      .where(eq(ordersTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    res.json({ order: updated });
  } catch (err) {
    req.log.error({ err }, "Failed to update order status");
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.post("/admin/downloads", requireAdmin, async (req, res) => {
  try {
    const { filename, recordCount, filters } = req.body as {
      filename?: string;
      recordCount?: number;
      filters?: string;
    };

    const [record] = await db
      .insert(adminDownloadsTable)
      .values({
        downloadedBy: "admin",
        filename: filename ?? "orders_export.csv",
        recordCount: recordCount ?? 0,
        filters: filters ?? null,
      })
      .returning();

    res.status(201).json({ download: record });
  } catch (err) {
    req.log.error({ err }, "Failed to log download");
    res.status(500).json({ error: "Failed to log download" });
  }
});

router.get("/admin/downloads", requireAdmin, async (req, res) => {
  try {
    const downloads = await db
      .select()
      .from(adminDownloadsTable)
      .orderBy(desc(adminDownloadsTable.downloadedAt))
      .limit(100);
    res.json({ downloads });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch downloads");
    res.status(500).json({ error: "Failed to fetch downloads" });
  }
});

export default router;
