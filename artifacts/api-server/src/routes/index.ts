import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tasksRouter from "./tasks";
import membersRouter from "./members";
import mealsRouter from "./meals";

const router: IRouter = Router();

router.use(healthRouter);
router.use(membersRouter);
router.use(tasksRouter);
router.use(mealsRouter);

export default router;
