import { Router, type IRouter } from "express";
import { db, ordersTable } from "@workspace/db";
import { CreateOrderBody } from "@workspace/api-zod";
import { nanoid } from "nanoid";

const router: IRouter = Router();

router.post("/orders", async (req, res) => {
  const parseResult = CreateOrderBody.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request data" });
    return;
  }

  const { name, phone, address, pincode, quantity, product } = parseResult.data;
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
        status: "pending",
      })
      .returning();

    res.status(201).json({
      id: order.id,
      orderId: order.orderId,
      message: `Thank you ${name}! Your order has been placed successfully. We will call you to confirm. Order ID: ${orderId}`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create order");
    res.status(500).json({ error: "Failed to place order. Please try again." });
  }
});

export default router;
