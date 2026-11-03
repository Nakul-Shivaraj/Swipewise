import { Request, Response, NextFunction } from "express";
import { storeSearchQuerySchema } from "@swipewise/shared";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  StoreRepository,
  storeRepo as defaultStoreRepo,
} from "../repositories/store.repository.js";
import { StoreService } from "../services/store.service.js";

function getService(req: Request): StoreService {
  const repo =
    (req.app.get("storeRepo") as StoreRepository) || defaultStoreRepo;
  return new StoreService(repo);
}

export async function searchStoresHandler(
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

    const rawQuery =
      typeof req.query.q === "string"
        ? req.query.q
        : typeof req.query.query === "string"
          ? req.query.query
          : undefined;

    const parseResult = storeSearchQuerySchema.safeParse({
      q: rawQuery,
    });

    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            parseResult.error.issues[0]?.message ||
            "Invalid store search query.",
        },
      });
      return;
    }

    const service = getService(req);
    const result = await service.searchStores(parseResult.data.q);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
