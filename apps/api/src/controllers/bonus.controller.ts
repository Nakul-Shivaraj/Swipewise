import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  BonusRepository,
  bonusRepo as defaultBonusRepo,
} from "../repositories/bonus.repository.js";
import {
  createSpendEntryRequestSchema,
  updateSpendEntryRequestSchema,
} from "@swipewise/shared";

function getBonusRepo(req: Request): BonusRepository {
  return (req.app.get("bonusRepo") as BonusRepository) || defaultBonusRepo;
}

function getNow(req: Request): Date {
  const nowProvider = req.app.get("nowProvider") as (() => Date) | undefined;
  return nowProvider ? nowProvider() : new Date();
}

export async function getBonusOffersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  if (!userId) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
    return;
  }

  const repo = getBonusRepo(req);
  const now = getNow(req);
  const bonuses = await repo.getUserBonusOffers(userId, now);

  res.status(200).json({ bonuses });
}

export async function getBonusOfferByWalletCardHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  if (!userId) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
    return;
  }

  const walletCardId = (req.params.walletCardId || req.params.id) as string;
  if (!walletCardId) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Wallet card ID is required." },
    });
    return;
  }

  const repo = getBonusRepo(req);
  const now = getNow(req);
  const bonus = await repo.getBonusOfferByWalletCardId(
    walletCardId,
    userId,
    now,
  );

  if (!bonus) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Wallet card or bonus offer not found.",
      },
    });
    return;
  }

  res.status(200).json({ bonus });
}

export async function addSpendEntryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  if (!userId) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
    return;
  }

  const walletCardId = (req.params.walletCardId || req.params.id) as string;
  if (!walletCardId) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Wallet card ID is required." },
    });
    return;
  }

  const parsed = createSpendEntryRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message || "Invalid spend entry data.",
      },
    });
    return;
  }

  const repo = getBonusRepo(req);
  const entry = await repo.addSpendEntry(userId, walletCardId, parsed.data);

  if (!entry) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Wallet card not found." },
    });
    return;
  }

  res.status(201).json({ spendEntry: entry });
}

export async function updateSpendEntryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  if (!userId) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
    return;
  }

  const spendEntryId = (req.params.spendEntryId || req.params.id) as string;
  if (!spendEntryId) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Spend entry ID is required." },
    });
    return;
  }

  const parsed = updateSpendEntryRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message || "Invalid update data.",
      },
    });
    return;
  }

  const repo = getBonusRepo(req);
  const updated = await repo.updateSpendEntry(
    userId,
    spendEntryId,
    parsed.data,
  );

  if (!updated) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Spend entry not found." },
    });
    return;
  }

  res.status(200).json({ spendEntry: updated });
}

export async function deleteSpendEntryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;
  if (!userId) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
    return;
  }

  const spendEntryId = (req.params.spendEntryId || req.params.id) as string;
  if (!spendEntryId) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Spend entry ID is required." },
    });
    return;
  }

  const repo = getBonusRepo(req);
  const deleted = await repo.deleteSpendEntry(userId, spendEntryId);

  if (!deleted) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Spend entry not found." },
    });
    return;
  }

  res.status(200).json({ success: true });
}
