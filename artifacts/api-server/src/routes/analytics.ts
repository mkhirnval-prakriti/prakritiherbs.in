import { Router, type IRouter } from "express";
import { db, ordersTable, pageViewsTable, abandonedCartsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

router.post("/analytics/pageview", async (req, res) => {
  try {
    const body = req.body as { path?: string; sessionId?: string; referrer?: string };
    await db.insert(pageViewsTable).values({
      path: body.path ?? "/",
      sessionId: body.sessionId ?? null,
      referrer: body.referrer ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    });
    res.status(201).json({ ok: true });
  } catch {
    res.status(200).json({ ok: false });
  }
});

router.get("/admin/analytics", requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const last7Start = new Date(todayStart);
    last7Start.setDate(last7Start.getDate() - 6);
    const last30Start = new Date(todayStart);
    last30Start.setDate(last30Start.getDate() - 29);

    const [
      ordersByDay,
      ordersByHour,
      ordersBySource,
      visitorStats,
      conversionData,
      topCities,
      abandonedStats,
    ] = await Promise.all([
      db.execute(sql`
        SELECT
          TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') as date,
          COUNT(*) as count
        FROM orders
        WHERE created_at >= ${last30Start}
        GROUP BY date ORDER BY date ASC
      `),
      db.execute(sql`
        SELECT
          EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')::int as hour,
          COUNT(*) as count
        FROM orders GROUP BY hour ORDER BY hour ASC
      `),
      db.execute(sql`
        SELECT source, COUNT(*) as count
        FROM orders GROUP BY source ORDER BY count DESC
      `),
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= ${todayStart}) as today,
          COUNT(*) FILTER (WHERE created_at >= ${yesterdayStart} AND created_at < ${todayStart}) as yesterday,
          COUNT(*) FILTER (WHERE created_at >= ${last7Start}) as last7,
          COUNT(*) FILTER (WHERE created_at >= ${last30Start}) as last30,
          COUNT(*) as total
        FROM page_views
      `),
      db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM page_views WHERE created_at >= ${last30Start}) as visitors_30d,
          (SELECT COUNT(*) FROM orders WHERE created_at >= ${last30Start}) as orders_30d,
          (SELECT COUNT(*) FROM page_views WHERE created_at >= ${last7Start}) as visitors_7d,
          (SELECT COUNT(*) FROM orders WHERE created_at >= ${last7Start}) as orders_7d,
          (SELECT COUNT(*) FROM page_views WHERE created_at >= ${todayStart}) as visitors_today,
          (SELECT COUNT(*) FROM orders WHERE created_at >= ${todayStart}) as orders_today
      `),
      db.execute(sql`
        SELECT
          TRIM(
            SPLIT_PART(
              REGEXP_REPLACE(address, '\\s+', ' ', 'g'),
              ',',
              ARRAY_LENGTH(STRING_TO_ARRAY(address, ','), 1) - 1
            )
          ) as city,
          COUNT(*) as count
        FROM orders
        WHERE address IS NOT NULL AND address != ''
        GROUP BY city
        HAVING TRIM(SPLIT_PART(REGEXP_REPLACE(address, '\\s+', ' ', 'g'), ',', ARRAY_LENGTH(STRING_TO_ARRAY(address, ','), 1) - 1)) != ''
        ORDER BY count DESC
        LIMIT 10
      `),
      db.execute(sql`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE recovery_status = 'New') as new_count,
          COUNT(*) FILTER (WHERE recovery_status = 'Called') as called,
          COUNT(*) FILTER (WHERE recovery_status = 'Recovered') as recovered
        FROM abandoned_carts
      `),
    ]);

    const visRow = (visitorStats.rows[0] ?? {}) as Record<string, unknown>;
    const convRow = (conversionData.rows[0] ?? {}) as Record<string, unknown>;
    const aRow = (abandonedStats.rows[0] ?? {}) as Record<string, unknown>;

    const v30 = Number(convRow["visitors_30d"] ?? 0);
    const o30 = Number(convRow["orders_30d"] ?? 0);
    const v7 = Number(convRow["visitors_7d"] ?? 0);
    const o7 = Number(convRow["orders_7d"] ?? 0);
    const vToday = Number(convRow["visitors_today"] ?? 0);
    const oToday = Number(convRow["orders_today"] ?? 0);

    res.json({
      ordersByDay: ordersByDay.rows.map((r) => {
        const row = r as Record<string, unknown>;
        return { date: String(row["date"] ?? ""), count: Number(row["count"] ?? 0) };
      }),
      ordersByHour: ordersByHour.rows.map((r) => {
        const row = r as Record<string, unknown>;
        return { hour: Number(row["hour"] ?? 0), count: Number(row["count"] ?? 0) };
      }),
      ordersBySource: ordersBySource.rows.map((r) => {
        const row = r as Record<string, unknown>;
        return { source: String(row["source"] ?? "Unknown"), count: Number(row["count"] ?? 0) };
      }),
      topCities: topCities.rows.map((r) => {
        const row = r as Record<string, unknown>;
        return { city: String(row["city"] ?? "Unknown").trim(), count: Number(row["count"] ?? 0) };
      }).filter((c) => c.city.length > 1),
      visitors: {
        today: Number(visRow["today"] ?? 0),
        yesterday: Number(visRow["yesterday"] ?? 0),
        last7: Number(visRow["last7"] ?? 0),
        last30: Number(visRow["last30"] ?? 0),
        total: Number(visRow["total"] ?? 0),
      },
      conversion: {
        last30: { visitors: v30, orders: o30, rate: v30 > 0 ? +((o30 / v30) * 100).toFixed(2) : 0 },
        last7: { visitors: v7, orders: o7, rate: v7 > 0 ? +((o7 / v7) * 100).toFixed(2) : 0 },
        today: { visitors: vToday, orders: oToday, rate: vToday > 0 ? +((oToday / vToday) * 100).toFixed(2) : 0 },
      },
      abandonedStats: {
        total: Number(aRow["total"] ?? 0),
        new: Number(aRow["new_count"] ?? 0),
        called: Number(aRow["called"] ?? 0),
        recovered: Number(aRow["recovered"] ?? 0),
      },
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

export default router;
