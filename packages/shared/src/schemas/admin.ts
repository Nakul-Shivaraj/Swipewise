import { z } from "zod";
import { noCardNumberRefinement } from "./auth.js";

const NO_CARD_NUMBER_MESSAGE =
  "Don't enter card numbers. SwipeWise only needs the card name.";

export const adminRewardRuleInputSchema = z.object({
  category: z.enum(["GROCERIES", "DINING", "GAS", "TRAVEL"]),
  rateX100: z.number().int().positive(),
  capCents: z.number().int().positive().nullable().optional(),
});

export type AdminRewardRuleInput = z.infer<typeof adminRewardRuleInputSchema>;

export const adminPerkInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a perk name.")
    .max(100)
    .refine(noCardNumberRefinement, {
      message: NO_CARD_NUMBER_MESSAGE,
    }),
  amountCents: z.number().int().positive(),
  period: z.enum(["MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"]),
});

export type AdminPerkInput = z.infer<typeof adminPerkInputSchema>;

export const adminBonusOfferInputSchema = z.object({
  spendRequirementCents: z.number().int().positive(),
  windowMonths: z.number().int().positive(),
  bonusPoints: z.number().int().positive(),
});

export type AdminBonusOfferInput = z.infer<typeof adminBonusOfferInputSchema>;

export const adminCreateCardSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a card name.")
    .max(100)
    .refine(noCardNumberRefinement, {
      message: NO_CARD_NUMBER_MESSAGE,
    }),
  issuer: z
    .string()
    .trim()
    .min(1, "Enter an issuer.")
    .max(100)
    .refine(noCardNumberRefinement, {
      message: NO_CARD_NUMBER_MESSAGE,
    }),
  artColor: z.string().trim().min(1, "Enter an art color.").max(50),
  isDemo: z.boolean().default(true),
  annualFeeCents: z.number().int().nonnegative(),
  baseRateX100: z.number().int().positive(),
  programId: z.string().uuid("Invalid rewards program ID."),
  rewardRules: z.array(adminRewardRuleInputSchema).default([]),
  perks: z.array(adminPerkInputSchema).optional().default([]),
  bonusOffer: adminBonusOfferInputSchema.nullable().optional(),
});

export type AdminCreateCardInput = z.infer<typeof adminCreateCardSchema>;

export const adminUpdateCardSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a card name.")
    .max(100)
    .refine(noCardNumberRefinement, {
      message: NO_CARD_NUMBER_MESSAGE,
    })
    .optional(),
  issuer: z
    .string()
    .trim()
    .min(1, "Enter an issuer.")
    .max(100)
    .refine(noCardNumberRefinement, {
      message: NO_CARD_NUMBER_MESSAGE,
    })
    .optional(),
  artColor: z.string().trim().min(1).max(50).optional(),
  isDemo: z.boolean().optional(),
  annualFeeCents: z.number().int().nonnegative().optional(),
  baseRateX100: z.number().int().positive().optional(),
  programId: z.string().uuid().optional(),
  isRetired: z.boolean().optional(),
  rewardRules: z.array(adminRewardRuleInputSchema).optional(),
  perks: z.array(adminPerkInputSchema).optional(),
  bonusOffer: adminBonusOfferInputSchema.nullable().optional(),
});

export type AdminUpdateCardInput = z.infer<typeof adminUpdateCardSchema>;

export const adminCreateStoreSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a store name.")
    .max(100)
    .refine(noCardNumberRefinement, {
      message: NO_CARD_NUMBER_MESSAGE,
    }),
  category: z.enum(["GROCERIES", "DINING", "GAS", "TRAVEL"]),
  aliases: z
    .array(
      z.string().trim().min(1).max(100).refine(noCardNumberRefinement, {
        message: NO_CARD_NUMBER_MESSAGE,
      }),
    )
    .default([]),
});

export type AdminCreateStoreInput = z.infer<typeof adminCreateStoreSchema>;

export const adminUpdateStoreSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a store name.")
    .max(100)
    .refine(noCardNumberRefinement, {
      message: NO_CARD_NUMBER_MESSAGE,
    })
    .optional(),
  category: z.enum(["GROCERIES", "DINING", "GAS", "TRAVEL"]).optional(),
  aliases: z
    .array(
      z.string().trim().min(1).max(100).refine(noCardNumberRefinement, {
        message: NO_CARD_NUMBER_MESSAGE,
      }),
    )
    .optional(),
});

export type AdminUpdateStoreInput = z.infer<typeof adminUpdateStoreSchema>;

export const adminAuditLogItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  userEmail: z.string().email(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export type AdminAuditLogItem = z.infer<typeof adminAuditLogItemSchema>;

export const adminAuditLogsResponseSchema = z.object({
  auditLogs: z.array(adminAuditLogItemSchema),
});

export type AdminAuditLogsResponse = z.infer<
  typeof adminAuditLogsResponseSchema
>;
