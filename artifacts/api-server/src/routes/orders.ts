import { Router, type IRouter } from "express";
import { db, ordersTable } from "@workspace/db";
import { CreateOrderBody } from "@workspace/api-zod";
import { nanoid } from "nanoid";
import { sendCapiEvent } from "../lib/metaCapi.js";

const router: IRouter = Router();

router.post("/orders", async (req, res) => {
  const parseResult = CreateOrderBody.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request data" });
    return;
  }

  const { name, phone, address, pincode, quantity, product } = parseResult.data;
  const body = req.body as {
    source?: string;
    eventId?: string;
    fbp?: string;
    fbc?: string;
    userAgent?: string;
    sourceUrl?: string;
  };
  const source = body.source ?? "COD";
  const orderId = `ORD-${nanoid(8).toUpperCase()}`;

  try {
    const [order] = await db
      .insert(ordersTable)
      .values({
        orderId,
        name,
        phone,
        address,
        pincode,
        quantity,
        product,
        source,
        status: "New",
      })
      .returning();

    // Fire server-side CAPI Lead event (fire-and-forget, never blocks response)
    sendCapiEvent({
      eventName: "Lead",
      eventId: body.eventId,
      phone,
      name,
      ipAddress: (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
        ?? req.socket.remoteAddress,
      userAgent: body.userAgent ?? (req.headers["user-agent"] as string | undefined),
      fbp: body.fbp,
      fbc: body.fbc,
      sourceUrl: body.sourceUrl ?? "https://prakritiherbs.in/",
      customData: {
        currency: "INR",
        value: 999,
        content_name: "KamaSutra Gold+",
        order_id: orderId,
      },
    }).catch((err) => {
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
