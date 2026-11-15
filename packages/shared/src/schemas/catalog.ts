import { z } from "zod";
import { noCardNumberRefinement } from "./auth.js";
import { CategoryName } from "./recommendations.js";

export const catalogRateSchema = z.object({
  category: z.enum(["GROCERIES", "DINING", "GAS", "TRAVEL"]),
  rateX100: z.number().int().positive(),
  capCents: z.number().int().positive().nullable().optional(),
});

export type CatalogRate = z.infer<typeof catalogRateSchema>;

export const rotatingCategoryRateSchema = z.object({
  quarter: z.string().regex(/^\d{4}-Q[1-4]$/),
  category: z.enum(["GROCERIES", "DINING", "GAS", "TRAVEL"]),
  rateX100: z.number().int().positive(),
  capCents: z.number().int().positive().nullable().optional(),
});

export type RotatingCategoryRate = z.infer<typeof rotatingCategoryRateSchema>;

export const catalogCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  issuer: z.string().min(1),
  artColor: z.string().min(1),
  isDemo: z.boolean(),
  annualFeeCents: z.number().int().nonnegative(),
  baseRateX100: z.number().int().positive(),
  isRetired: z.boolean().optional(),
  program: z.object({
    name: z.string().min(1),
    centsPer100Points: z.number().int().positive(),
  }),
  rates: z.array(catalogRateSchema),
  rotatingCategories: z.array(rotatingCategoryRateSchema).optional(),
});

export type CatalogCard = z.infer<typeof catalogCardSchema>;

export const catalogCardsResponseSchema = z.object({
  cards: z.array(catalogCardSchema),
});

export type CatalogCardsResponse = z.infer<typeof catalogCardsResponseSchema>;

export const publicQueryGuardSchema = z
  .record(z.string(), z.unknown())
  .superRefine((query, ctx) => {
    for (const [key, value] of Object.entries(query)) {
      if (!noCardNumberRefinement(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Don't enter card numbers. SwipeWise only needs the card name.",
        });
        return;
      }
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) {
        if (typeof item === "string" && !noCardNumberRefinement(item)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Don't enter card numbers. SwipeWise only needs the card name.",
          });
          return;
        }
      }
    }
  });

export const publicEmptyQuerySchema = publicQueryGuardSchema.superRefine(
  (query, ctx) => {
    const keys = Object.keys(query);
    if (keys.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unexpected query parameters.",
      });
    }
  },
);

export interface PublicRankedCardResult {
  cardId: string;
  name: string;
  issuer: string;
  artColor: string;
  isDemo: boolean;
  annualFeeCents: number;
  programName: string;
  centsPer100Points: number;
  appliedRateX100: number;
  baseRateX100: number;
  usedBaseRate: boolean;
  capCents: number | null;
  isCapExceeded: boolean;
  rewardCents: number;
  activationNote: string | null;
  rank: number;
  isBestPick: boolean;
}

export interface PublicRecommendationsResponse {
  category: CategoryName;
  amountCents: number;
  bestCard: PublicRankedCardResult | null;
  rankedCards: PublicRankedCardResult[];
}
