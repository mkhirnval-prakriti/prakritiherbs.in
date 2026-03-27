import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import crmRouter from "./crm";
import adminRouter from "./admin";
import analyticsRouter from "./analytics";
import reviewsRouter from "./reviews";
import settingsRouter from "./settings";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ordersRouter);
router.use(crmRouter);
router.use(adminRouter);
router.use(analyticsRouter);
router.use(reviewsRouter);
router.use(settingsRouter);
router.use(paymentsRouter);

export default router;
