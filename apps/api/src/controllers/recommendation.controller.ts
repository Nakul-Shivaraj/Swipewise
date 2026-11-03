import { Request, Response, NextFunction } from "express";
import { recommendationsQuerySchema } from "@swipewise/shared";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  RecommendationRepository,
  recommendationRepo as defaultRecommendationRepo,
} from "../repositories/recommendation.repository.js";
import { RecommendationService } from "../services/recommendation.service.js";

function getService(req: Request): RecommendationService {
  const repo =
    (req.app.get("recommendationRepo") as RecommendationRepository) ||
    defaultRecommendationRepo;
  return new RecommendationService(repo);
}

export async function getRecommendationsHandler(
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

    const parseResult = recommendationsQuerySchema.safeParse({
      category:
        typeof req.query.category === "string" ? req.query.category : undefined,
      amountCents:
        typeof req.query.amountCents === "string"
          ? req.query.amountCents
          : undefined,
    });

    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            parseResult.error.issues[0]?.message || "Invalid query parameters.",
        },
      });
      return;
    }

    const { category, amountCents } = parseResult.data;
    const service = getService(req);
    const result = await service.getRecommendationsForCategory(
      authReq.user.id,
      category,
      amountCents,
    );

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
