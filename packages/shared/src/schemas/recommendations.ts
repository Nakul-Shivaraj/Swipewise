import { z } from "zod";

export const CATEGORIES = ["GROCERIES", "DINING", "GAS", "TRAVEL"] as const;

export const categorySchema = z.enum(CATEGORIES);
export type CategoryName = z.infer<typeof categorySchema>;

export const DEFAULT_PURCHASE_AMOUNT_CENTS = 10000; // $100.00
export const MIN_PURCHASE_AMOUNT_CENTS = 1; // $0.01
export const MAX_PURCHASE_AMOUNT_CENTS = 100_000_000; // $1,000,000.00

const amountCentsSchema = z
  .union([z.string(), z.number(), z.undefined()])
  .transform((val, ctx) => {
    if (val === undefined) {
      return DEFAULT_PURCHASE_AMOUNT_CENTS;
    }
    if (typeof val === "number") {
      if (!Number.isInteger(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Purchase amount must be a whole number of cents.",
        });
        return z.NEVER;
      }
      return val;
    }
    const trimmed = val.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Purchase amount must be a whole number of cents.",
      });
      return z.NEVER;
    }
    return Number.parseInt(trimmed, 10);
  })
  .pipe(
    z
      .number()
      .int("Purchase amount must be a whole number of cents.")
      .min(
        MIN_PURCHASE_AMOUNT_CENTS,
        "Purchase amount must be between 1 and 100,000,000 cents.",
      )
      .max(
        MAX_PURCHASE_AMOUNT_CENTS,
        "Purchase amount must be between 1 and 100,000,000 cents.",
      ),
  );

export const recommendationsQuerySchema = z.object({
  category: categorySchema,
  amountCents: amountCentsSchema
    .optional()
    .default(DEFAULT_PURCHASE_AMOUNT_CENTS),
});

export type RecommendationsQuery = z.infer<typeof recommendationsQuerySchema>;

export interface RankedCardResult {
  walletCardId: string;
  cardId: string;
  name: string;
  issuer: string;
  artColor: string;
  isDemo: boolean;
  nickname: string | null;
  annualFeeCents: number;
  programName: string;
  centsPer100Points: number;
  appliedRateX100: number;
  baseRateX100: number;
  usedBaseRate: boolean;
  capCents: number | null;
  isCapExceeded: boolean;
  rewardCents: number;
  rank: number;
  isBestPick: boolean;
}

export interface RecommendationsResponse {
  category: CategoryName;
  amountCents: number;
  isEmptyWallet: boolean;
  rankedCards: RankedCardResult[];
}
