import { Request, Response, NextFunction } from "express";
import {
  adminCreateCardSchema,
  adminUpdateCardSchema,
  adminCreateStoreSchema,
  adminUpdateStoreSchema,
} from "@swipewise/shared";
import {
  adminRepo as defaultAdminRepo,
  AdminRepository,
} from "../repositories/admin.repository.js";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";

function getRepo(req: Request): AdminRepository {
  return (req.app.get("adminRepo") as AdminRepository) || defaultAdminRepo;
}

export async function getAdminCardsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repo = getRepo(req);
    const cards = await repo.findAllCards();
    res.status(200).json({ cards });
  } catch (err) {
    next(err);
  }
}

export async function createAdminCardHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    if (!userId) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required." },
      });
      return;
    }

    const parseResult = adminCreateCardSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: parseResult.error.issues[0]?.message || "Invalid card data.",
          details: parseResult.error.issues,
        },
      });
      return;
    }

    const repo = getRepo(req);
    const card = await repo.createCard(userId, parseResult.data);
    res.status(201).json({ card });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminCardHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    if (!userId) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required." },
      });
      return;
    }

    const cardId = req.params.id as string;
    const parseResult = adminUpdateCardSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: parseResult.error.issues[0]?.message || "Invalid card data.",
          details: parseResult.error.issues,
        },
      });
      return;
    }

    const repo = getRepo(req);
    const card = await repo.updateCard(userId, cardId, parseResult.data);
    if (!card) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Card not found." },
      });
      return;
    }

    res.status(200).json({ card });
  } catch (err) {
    next(err);
  }
}

export async function retireAdminCardHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    if (!userId) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required." },
      });
      return;
    }

    const cardId = req.params.id as string;
    const repo = getRepo(req);
    const card = await repo.retireCard(userId, cardId);
    if (!card) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Card not found." },
      });
      return;
    }

    res.status(200).json({ card });
  } catch (err) {
    next(err);
  }
}

export async function getAdminStoresHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repo = getRepo(req);
    const stores = await repo.findAllStores();
    res.status(200).json({ stores });
  } catch (err) {
    next(err);
  }
}

export async function createAdminStoreHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    if (!userId) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required." },
      });
      return;
    }

    const parseResult = adminCreateStoreSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            parseResult.error.issues[0]?.message || "Invalid store data.",
          details: parseResult.error.issues,
        },
      });
      return;
    }

    const repo = getRepo(req);
    const store = await repo.createStore(userId, parseResult.data);
    res.status(201).json({ store });
  } catch (err) {
    next(err);
  }
}

export async function updateAdminStoreHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    if (!userId) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required." },
      });
      return;
    }

    const storeId = req.params.id as string;
    const parseResult = adminUpdateStoreSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            parseResult.error.issues[0]?.message || "Invalid store data.",
          details: parseResult.error.issues,
        },
      });
      return;
    }

    const repo = getRepo(req);
    const store = await repo.updateStore(userId, storeId, parseResult.data);
    if (!store) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Store not found." },
      });
      return;
    }

    res.status(200).json({ store });
  } catch (err) {
    next(err);
  }
}

export async function getAdminAuditLogsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const repo = getRepo(req);
    const auditLogs = await repo.findAuditLogs();
    res.status(200).json({ auditLogs });
  } catch (err) {
    next(err);
  }
}
