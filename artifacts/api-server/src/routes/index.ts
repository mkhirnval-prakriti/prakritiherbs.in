import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import crmRouter from "./crm";
import adminRouter from "./admin";
import analyticsRouter from "./analytics";
import reviewsRouter from "./reviews";
import settingsRouter from "./settings";
import paymentsRouter from "./payments";
import liveRouter from "./live";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(liveRouter);
router.use(ordersRouter);
router.use(crmRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(analyticsRouter);
router.use(reviewsRouter);
router.use(settingsRouter);
router.use(paymentsRouter);

export default router;
