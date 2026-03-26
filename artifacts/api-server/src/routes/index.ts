import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import crmRouter from "./crm";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ordersRouter);
router.use(crmRouter);

export default router;
