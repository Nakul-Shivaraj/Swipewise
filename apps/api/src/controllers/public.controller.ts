import { Request, Response, NextFunction } from "express";
import {
  publicEmptyQuerySchema,
  publicQueryGuardSchema,
  recommendationsQuerySchema,
  storeSearchQuerySchema,
} from "@swipewise/shared";
import { generateOpenApiSpec } from "../public/openapi-generator.js";
import {
  CatalogRepository,
  catalogRepo as defaultCatalogRepo,
} from "../repositories/catalog.repository.js";
import {
  StoreRepository,
  storeRepo as defaultStoreRepo,
} from "../repositories/store.repository.js";
import { PublicService } from "../services/public.service.js";

function getPublicService(req: Request): PublicService {
  const cRepo =
    (req.app.get("catalogRepo") as CatalogRepository) || defaultCatalogRepo;
  const sRepo =
    (req.app.get("storeRepo") as StoreRepository) || defaultStoreRepo;
  return new PublicService(cRepo, sRepo);
}

export async function getPublicCardsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const queryCheck = publicEmptyQuerySchema.safeParse(req.query);
    if (!queryCheck.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            queryCheck.error.issues[0]?.message || "Invalid query parameters.",
        },
      });
      return;
    }

    const service = getPublicService(req);
    const result = await service.getCatalogCards();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getPublicCategoriesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const queryCheck = publicEmptyQuerySchema.safeParse(req.query);
    if (!queryCheck.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            queryCheck.error.issues[0]?.message || "Invalid query parameters.",
        },
      });
      return;
    }

    const service = getPublicService(req);
    const result = service.getCategories();
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getPublicRecommendationsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const guardCheck = publicQueryGuardSchema.safeParse(req.query);
    if (!guardCheck.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            guardCheck.error.issues[0]?.message || "Invalid query parameters.",
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

    let cardIds: string[] | undefined;
    if (typeof req.query.cardIds === "string") {
      cardIds = req.query.cardIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (Array.isArray(req.query.cardIds)) {
      cardIds = req.query.cardIds
        .flatMap((item) => (typeof item === "string" ? item.split(",") : []))
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const { category, amountCents } = parseResult.data;
    const nowProvider =
      (req.app.get("nowProvider") as (() => Date) | undefined) ||
      (() => new Date());
    const service = getPublicService(req);
    const result = await service.getRecommendationsForCategory(
      category,
      amountCents,
      nowProvider(),
      cardIds,
    );

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function searchPublicStoresHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const guardCheck = publicQueryGuardSchema.safeParse(req.query);
    if (!guardCheck.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            guardCheck.error.issues[0]?.message ||
            "Invalid store search query.",
        },
      });
      return;
    }

    const rawQuery =
      typeof req.query.query === "string"
        ? req.query.query
        : typeof req.query.q === "string"
          ? req.query.q
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

    const service = getPublicService(req);
    const result = await service.searchStores(parseResult.data.q);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export function getPublicOpenApiHandler(req: Request, res: Response): void {
  const queryCheck = publicEmptyQuerySchema.safeParse(req.query);
  if (!queryCheck.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message:
          queryCheck.error.issues[0]?.message || "Invalid query parameters.",
      },
    });
    return;
  }

  res.status(200).json(generateOpenApiSpec());
}
