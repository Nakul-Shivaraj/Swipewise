import { Request, Response } from "express";
import { z } from "zod";
import { upsertPointsBalanceRequestSchema } from "@swipewise/shared";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { PointsBalanceService } from "../services/points-balance.service.js";
import { PointsBalanceRepository } from "../repositories/points-balance.repository.js";

function getService(req: Request): PointsBalanceService {
  const repo = req.app.get("pointsBalanceRepo") as
    | PointsBalanceRepository
    | undefined;
  return new PointsBalanceService(repo);
}

const uuidParamSchema = z.string().uuid();

export async function getPointsBalancesHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required." },
      });
      return;
    }

    const service = getService(req);
    const programs = await service.getWalletProgramsWithBalances(userId);
    res.status(200).json({ programs });
  } catch (err) {
    console.error("Get points balances error:", err);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Try again.",
      },
    });
  }
}

export async function upsertPointsBalanceHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Authentication required." },
      });
      return;
    }

    const programId = String(req.params.programId || "");
    if (!uuidParamSchema.safeParse(programId).success) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Rewards program not found in your wallet.",
        },
      });
      return;
    }

    const parsed = upsertPointsBalanceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: firstIssue?.message || "Invalid input.",
        },
      });
      return;
    }

    const service = getService(req);
    const result = await service.upsertProgramBalance(
      userId,
      programId,
      parsed.data,
    );

    if (result.error) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.status(200).json({ programBalance: result.programBalance });
  } catch (err) {
    console.error("Upsert points balance error:", err);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Try again.",
      },
    });
  }
}
