import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hostAccessRouter from "./host-access";
import quizzesRouter from "./quizzes";
import gamesRouter from "./games";

const router: IRouter = Router();

router.use(healthRouter);
router.use(hostAccessRouter);
router.use(quizzesRouter);
router.use(gamesRouter);

export default router;
