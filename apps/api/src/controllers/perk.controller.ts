import { Request, Response } from "express";
import { markPerkUsageSchema } from "@swipewise/shared";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { PerkService } from "../services/perk.service.js";
import { PerkRepository } from "../repositories/perk.repository.js";
import { UserRepository } from "../repositories/user.repository.js";

function getServiceFromReq(req: Request): PerkService {
  const perkRepo =
    (req.app.get("perkRepo") as PerkRepository | undefined) ||
    new PerkRepository(req.app.get("prisma"));
  const userRepo =
    (req.app.get("userRepo") as UserRepository | undefined) ||
    new UserRepository(req.app.get("prisma"));
  const nowProvider = req.app.get("nowProvider") as (() => Date) | undefined;

  return new PerkService(perkRepo, userRepo, nowProvider);
}

export async function getPerksHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
    return;
  }

  try {
    const service = getServiceFromReq(req);
    const result = await service.getWalletCardPerks(userId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching perks:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Try again.",
      },
    });
  }
}

export async function markPerkUsageHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
    return;
  }

  const walletCardId = req.params.walletCardId || req.body?.walletCardId;
  const perkId = req.params.perkId || req.params.id || req.body?.perkId;

  if (!walletCardId || !perkId) {
    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "walletCardId and perkId are required.",
      },
    });
    return;
  }

  const parseResult = markPerkUsageSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message:
          parseResult.error.issues[0]?.message || "Invalid perk usage payload.",
      },
    });
    return;
  }

  const { usedCents, isFull } = parseResult.data;

  try {
    const service = getServiceFromReq(req);
    const result = await service.markPerkUsage({
      userId,
      walletCardId,
      perkId,
      usedCents,
      isFull,
    });

    if (result.error) {
      const status =
        result.error.code === "NOT_FOUND"
          ? 404
          : result.error.code === "USAGE_EXCEEDS_PERK_AMOUNT"
            ? 400
            : 400;
      res.status(status).json({ error: result.error });
      return;
    }

    res.status(200).json({ perk: result.perk });
  } catch (error) {
    console.error("Error marking perk usage:", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Try again.",
      },
    });
  }
}
