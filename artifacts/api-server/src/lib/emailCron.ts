import cron from "node-cron";
import nodemailer from "nodemailer";
import { db, ordersTable } from "@workspace/db";
import { sql, gte } from "drizzle-orm";

const SMTP_HOST = process.env["SMTP_HOST"];
const SMTP_PORT = parseInt(process.env["SMTP_PORT"] ?? "587", 10);
const SMTP_USER = process.env["SMTP_USER"];
const SMTP_PASS = process.env["SMTP_PASS"];
const REPORT_EMAIL = process.env["REPORT_EMAIL"] ?? "contact@prakritiherbs.in";

async function sendDailySummary() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log("[EMAIL] SMTP not configured — skipping daily summary");
    return;
  }

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [summary] = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'New') as new_orders,
        COUNT(*) FILTER (WHERE status = 'Confirmed') as confirmed,
        COUNT(*) FILTER (WHERE status = 'Shipped') as shipped,
        COUNT(*) FILTER (WHERE status = 'Delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'Cancelled') as cancelled,
        COALESCE(SUM(999 * quantity), 0) as revenue
      FROM orders
      WHERE created_at >= ${todayStart}
    `);

    const recent = await db.execute(sql`
      SELECT name, phone, address, pincode, quantity, source, status, created_at
      FROM orders
      WHERE created_at >= ${todayStart}
      ORDER BY created_at DESC
      LIMIT 50
    `);

    const row = (summary.rows[0] ?? {}) as Record<string, unknown>;
    const total = Number(row["total"] ?? 0);
    const revenue = Number(row["revenue"] ?? 0);
    const dateStr = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "long", year: "numeric" });

    const orderRows = recent.rows.map((r) => {
      const o = r as Record<string, unknown>;
      const dt = new Date(String(o["created_at"] ?? "")).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
      return `<tr style="border-bottom:1px solid #eee">
        <td style="padding:6px 8px">${dt}</td>
        <td style="padding:6px 8px">${String(o["name"] ?? "")}</td>
        <td style="padding:6px 8px">${String(o["phone"] ?? "")}</td>
        <td style="padding:6px 8px">${String(o["address"] ?? "").substring(0, 30)}</td>
        <td style="padding:6px 8px">${String(o["pincode"] ?? "")}</td>
        <td style="padding:6px 8px">${String(o["source"] ?? "")}</td>
        <td style="padding:6px 8px;font-weight:bold;color:#1B5E20">${String(o["status"] ?? "")}</td>
      </tr>`;
    }).join("");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
  <div style="max-width:800px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
    <div style="background:linear-gradient(135deg,#1B5E20,#2E7D32);padding:24px;text-align:center">
      <h1 style="color:#C9A14A;margin:0;font-size:22px">Prakriti Herbs — Daily Report</h1>
      <p style="color:#fff;margin:8px 0 0;opacity:0.8">${dateStr}</p>
    </div>
    <div style="padding:24px">
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px">
        ${[
          ["Total Orders", String(total), "#1B5E20"],
          ["New", String(row["new_orders"] ?? 0), "#2196F3"],
          ["Confirmed", String(row["confirmed"] ?? 0), "#FF9800"],
          ["Shipped", String(row["shipped"] ?? 0), "#9C27B0"],
          ["Delivered", String(row["delivered"] ?? 0), "#4CAF50"],
          ["Cancelled", String(row["cancelled"] ?? 0), "#F44336"],
          ["Revenue (est.)", `₹${revenue.toLocaleString()}`, "#C9A14A"],
        ].map(([label, value, color]) => `
          <div style="flex:1;min-width:100px;background:#f8f9fa;border-radius:8px;padding:12px;text-align:center;border-top:3px solid ${color}">
            <p style="margin:0;font-size:11px;color:#666;text-transform:uppercase;font-weight:bold">${label}</p>
            <p style="margin:4px 0 0;font-size:22px;font-weight:bold;color:${color}">${value}</p>
          </div>
        `).join("")}
      </div>
      ${total > 0 ? `
      <h3 style="color:#1B5E20;margin-bottom:12px">Today's Orders</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead style="background:#1B5E20;color:white">
          <tr>
            <th style="padding:8px;text-align:left">Time</th>
            <th style="padding:8px;text-align:left">Name</th>
            <th style="padding:8px;text-align:left">Mobile</th>
            <th style="padding:8px;text-align:left">Address</th>
            <th style="padding:8px;text-align:left">Pincode</th>
            <th style="padding:8px;text-align:left">Source</th>
            <th style="padding:8px;text-align:left">Status</th>
          </tr>
        </thead>
        <tbody>${orderRows}</tbody>
      </table>` : `<p style="text-align:center;color:#999;padding:20px">No orders today.</p>`}
    </div>
    <div style="background:#f8f9fa;padding:16px;text-align:center;border-top:1px solid #eee">
      <p style="margin:0;font-size:11px;color:#999">Prakriti Herbs CRM • Auto-generated report • Do not reply</p>
    </div>
  </div>
</body>
</html>`;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"Prakriti CRM" <${SMTP_USER}>`,
      to: REPORT_EMAIL,
      subject: `📦 Daily Order Report — ${dateStr} (${total} orders)`,
      html,
    });

    console.log(`[EMAIL] Daily summary sent to ${REPORT_EMAIL} — ${total} orders today`);
  } catch (err) {
    console.error("[EMAIL] Failed to send daily summary:", err);
  }
}

export function startEmailCron() {
  cron.schedule("59 23 * * *", () => {
    void sendDailySummary();
  }, { timezone: "Asia/Kolkata" });
  console.log("[EMAIL] Daily report cron scheduled at 23:59 IST");
}
