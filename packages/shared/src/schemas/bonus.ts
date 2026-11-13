import { z } from "zod";
import { noCardNumberRefinement } from "./auth.js";

export const spendEntrySchema = z.object({
  id: z.string(),
  walletCardId: z.string(),
  walletCardBonusOfferId: z.string().nullable().optional(),
  amountCents: z.number().int("amountCents must be an integer"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  note: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type SpendEntry = z.infer<typeof spendEntrySchema>;

export const createSpendEntryRequestSchema = z.object({
  amountCents: z.number().int("amountCents must be an integer"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  note: z
    .string()
    .max(255, "Note cannot exceed 255 characters")
    .refine(
      noCardNumberRefinement,
      "Don't enter card numbers. SwipeWise only needs the card name.",
    )
    .optional(),
});

export type CreateSpendEntryRequest = z.infer<
  typeof createSpendEntryRequestSchema
>;

export const updateSpendEntryRequestSchema = z.object({
  amountCents: z.number().int("amountCents must be an integer").optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
    .optional(),
  note: z
    .string()
    .max(255, "Note cannot exceed 255 characters")
    .refine(
      noCardNumberRefinement,
      "Don't enter card numbers. SwipeWise only needs the card name.",
    )
    .nullable()
    .optional(),
});

export type UpdateSpendEntryRequest = z.infer<
  typeof updateSpendEntryRequestSchema
>;

export type BonusTrackerStatus = "In progress" | "Earned" | "Missed";

export const bonusOfferProgressSchema = z.object({
  walletCardId: z.string(),
  cardName: z.string(),
  cardNickname: z.string().nullable().optional(),
  cardArtColor: z.string().optional(),
  bonusOfferId: z.string().optional(),
  requiredSpendCents: z.number().int().min(0),
  spendRequirementCents: z.number().int().min(0),
  windowMonths: z.number().int().min(1),
  bonusPoints: z.number().int().min(0),
  openedDate: z.string().nullable(),
  deadline: z.string().nullable(),
  daysLeft: z.number().int().nullable(),
  spentCents: z.number().int(),
  remainingCents: z.number().int().min(0),
  progressPercent: z.number().min(0).max(100),
  status: z.enum(["In progress", "Earned", "Missed"]),
  requiresOpenDate: z.boolean(),
  spendEntries: z.array(spendEntrySchema),
});

export type BonusOfferProgressItem = z.infer<typeof bonusOfferProgressSchema>;

export const bonusOffersResponseSchema = z.object({
  bonuses: z.array(bonusOfferProgressSchema),
});

export type BonusOffersResponse = z.infer<typeof bonusOffersResponseSchema>;
