import { Router, type IRouter } from "express";
import {
  clearHostAccessCookie,
  hasHostAccess,
  setHostAccessCookie,
  verifyHostAccessCode,
} from "../middlewares/hostAccess";

const router: IRouter = Router();

router.get("/host-access/status", (req, res) => {
  res.json({ authenticated: hasHostAccess(req) });
});

router.post("/host-access/login", (req, res): void => {
  const accessKey = String(req.body?.accessKey ?? "");

  if (!verifyHostAccessCode(accessKey)) {
    res.status(401).json({ error: "Invalid host access code" });
    return;
  }

  setHostAccessCookie(res);
  res.json({ authenticated: true });
});

router.post("/host-access/logout", (_req, res) => {
  clearHostAccessCookie(res);
  res.json({ authenticated: false });
});

export default router;
