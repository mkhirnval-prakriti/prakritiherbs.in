import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import crmRouter from "./crm";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ordersRouter);
router.use(crmRouter);
router.use(adminRouter);

export default router;
