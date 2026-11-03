import { Request, Response, NextFunction } from "express";
import {
  addWalletCardRequestSchema,
  updateWalletCardRequestSchema,
} from "@swipewise/shared";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  WalletRepository,
  walletRepo as defaultWalletRepo,
} from "../repositories/wallet.repository.js";
import {
  CatalogRepository,
  catalogRepo as defaultCatalogRepo,
} from "../repositories/catalog.repository.js";
import { WalletService } from "../services/wallet.service.js";

function getWalletService(req: Request): WalletService {
  const wRepo =
    (req.app.get("walletRepo") as WalletRepository) || defaultWalletRepo;
  const cRepo =
    (req.app.get("catalogRepo") as CatalogRepository) || defaultCatalogRepo;
  return new WalletService(wRepo, cRepo);
}

export async function getCatalogCardsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const service = getWalletService(_req);
    const cards = await service.getCatalogCards();
    res.status(200).json({ cards });
  } catch (err) {
    next(err);
  }
}

export async function getWalletCardsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const service = getWalletService(req);
    const walletCards = await service.getWalletCards(authReq.user.id);
    res.status(200).json({ walletCards });
  } catch (err) {
    next(err);
  }
}

export async function addWalletCardHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const parseResult = addWalletCardRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: parseResult.error.issues[0]?.message || "Invalid card data.",
        },
      });
      return;
    }

    const service = getWalletService(req);
    const result = await service.addWalletCard(
      authReq.user.id,
      parseResult.data,
    );

    if (result.error) {
      const status = result.error.code === "CARD_NOT_FOUND" ? 404 : 400;
      res.status(status).json({ error: result.error });
      return;
    }

    res.status(201).json({ walletCard: result.walletCard });
  } catch (err) {
    next(err);
  }
}

export async function updateWalletCardHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id || typeof id !== "string") {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Card ID is required.",
        },
      });
      return;
    }

    const parseResult = updateWalletCardRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            parseResult.error.issues[0]?.message || "Invalid update data.",
        },
      });
      return;
    }

    const service = getWalletService(req);
    const result = await service.updateWalletCard(
      authReq.user.id,
      id,
      parseResult.data,
    );

    if (result.error) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.status(200).json({ walletCard: result.walletCard });
  } catch (err) {
    next(err);
  }
}

export async function deleteWalletCardHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id || typeof id !== "string") {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Card ID is required.",
        },
      });
      return;
    }

    const service = getWalletService(req);
    const result = await service.removeWalletCard(authReq.user.id, id);

    if (result.error) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.status(200).json({ success: true, message: "Card removed." });
  } catch (err) {
    next(err);
  }
}
