import { Router, type IRouter } from "express";
import { db, ordersTable } from "@workspace/db";
import { CreateOrderBody } from "@workspace/api-zod";
import { nanoid } from "nanoid";
import { sendCapiToAllAgencies } from "../lib/metaCapi.js";

const router: IRouter = Router();

router.post("/orders", async (req, res) => {
  const parseResult = CreateOrderBody.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request data" });
    return;
  }

  const { name, phone, address, pincode, quantity, product } = parseResult.data;
  const body = req.body as {
    email?: string;
    source?: string;
    visitorSource?: string;
    eventId?: string;
    fbp?: string;
    fbc?: string;
    userAgent?: string;
    city?: string;
    state?: string;
  };
  const source = body.source ?? "COD";
  const visitorSource = body.visitorSource ?? "Direct";
  const city = typeof body.city === "string" ? body.city.trim() || null : null;
  const state = typeof body.state === "string" ? body.state.trim() || null : null;
  /* Email is stored locally only — NEVER forwarded to CRM or Meta CAPI */
  const email = typeof body.email === "string" && body.email.includes("@") ? body.email.trim().toLowerCase() : null;
  const orderId = `ORD-${nanoid(8).toUpperCase()}`;

  try {
    const [order] = await db
      .insert(ordersTable)
      .values({
        orderId,
        name,
        phone,
        email,
        address,
        pincode,
        city,
        state,
        quantity,
        product,
        source,
        visitorSource,
        status: "New",
      })
      .returning();

    // Fire server-side CAPI Lead event to ALL active agency pixels simultaneously
    // (fire-and-forget — never blocks response)
    sendCapiToAllAgencies({
      eventName:  "Lead",
      eventId:    body.eventId,
      phone,
      name,
      ipAddress:  (req.headers["x-forwarded-for"] as string | undefined)
                    ?.split(",")[0]?.trim() ?? req.socket.remoteAddress,
      userAgent:  body.userAgent ?? (req.headers["user-agent"] as string | undefined),
      fbp:        body.fbp,
      fbc:        body.fbc,
      customData: {
        order_id: orderId,
        num_items: quantity,
      },
    }, source).catch((err) => {
      req.log.warn({ err }, "[CAPI] Lead event failed (non-blocking)");
    });

    res.status(201).json({
      id: order.id,
      orderId: order.orderId,
      message: `Thank you ${name}! Your order has been placed successfully. Order ID: ${orderId}`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create order");
    res.status(500).json({ error: "Failed to place order. Please try again." });
  }
});

export default router;
