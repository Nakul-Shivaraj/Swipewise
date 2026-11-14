import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";
import {
  getAdminCardsHandler,
  createAdminCardHandler,
  updateAdminCardHandler,
  retireAdminCardHandler,
  getAdminStoresHandler,
  createAdminStoreHandler,
  updateAdminStoreHandler,
  getAdminAuditLogsHandler,
} from "../controllers/admin.controller.js";

export function createAdminRouter(): Router {
  const router = Router();

  router.use(requireAuth);
  router.use(requireAdmin);

  router.get("/cards", getAdminCardsHandler);
  router.post("/cards", createAdminCardHandler);
  router.patch("/cards/:id", updateAdminCardHandler);
  router.post("/cards/:id/retire", retireAdminCardHandler);

  router.get("/stores", getAdminStoresHandler);
  router.post("/stores", createAdminStoreHandler);
  router.patch("/stores/:id", updateAdminStoreHandler);

  router.get("/audit-logs", getAdminAuditLogsHandler);

  return router;
}
