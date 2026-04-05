import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import productsRouter from "./products";
import suppliersRouter from "./suppliers";
import purchasesRouter from "./purchases";
import salesRouter from "./sales";
import debtsRouter from "./debts";
import dashboardRouter from "./dashboard";
import customersRouter from "./customers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(productsRouter);
router.use(suppliersRouter);
router.use(purchasesRouter);
router.use(salesRouter);
router.use(debtsRouter);
router.use(dashboardRouter);
router.use(customersRouter);

export default router;
