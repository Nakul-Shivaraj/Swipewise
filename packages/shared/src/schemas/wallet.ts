import { z } from "zod";
import { noCardNumberRefinement } from "./auth.js";
import { catalogCardSchema } from "./catalog.js";

export const addWalletCardRequestSchema = z.object({
  cardId: z.string().uuid(),
  nickname: z
    .string()
    .trim()
    .max(60, "Nickname must be 60 characters or fewer.")
    .refine(
      noCardNumberRefinement,
      "Don't enter card numbers. SwipeWise only needs the card name.",
    )
    .nullable()
    .optional(),
  openedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD.")
    .nullable()
    .optional(),
});

export type AddWalletCardRequest = z.infer<typeof addWalletCardRequestSchema>;

export const updateWalletCardRequestSchema = z.object({
  nickname: z
    .string()
    .trim()
    .max(60, "Nickname must be 60 characters or fewer.")
    .refine(
      noCardNumberRefinement,
      "Don't enter card numbers. SwipeWise only needs the card name.",
    )
    .nullable()
    .optional(),
});

export type UpdateWalletCardRequest = z.infer<
  typeof updateWalletCardRequestSchema
>;

export const dueDaySchema = z
  .number()
  .int("Due day must be a whole number between 1 and 31.")
  .min(1, "Due day must be between 1 and 31.")
  .max(31, "Due day must be between 1 and 31.");

export const walletCardPaymentSettingsSchema = z.object({
  dueDay: dueDaySchema,
  isAutopay: z.boolean(),
});

export type WalletCardPaymentSettings = z.infer<
  typeof walletCardPaymentSettingsSchema
>;

export const updatePaymentSettingsRequestSchema = z.object({
  dueDay: dueDaySchema,
  isAutopay: z.boolean().default(false),
});

export type UpdatePaymentSettingsRequest = z.infer<
  typeof updatePaymentSettingsRequestSchema
>;

export const cycleYearMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Invalid cycle format. Use YYYY-MM.");

export const markCyclePaidRequestSchema = z.object({
  cycleYearMonth: cycleYearMonthSchema,
});

export type MarkCyclePaidRequest = z.infer<typeof markCyclePaidRequestSchema>;

export const quarterSchema = z
  .string()
  .regex(
    /^\d{4}-Q[1-4]$/,
    "Invalid quarter format. Use YYYY-Q1 through YYYY-Q4.",
  );

export const activateQuarterRequestSchema = z.object({
  quarter: quarterSchema,
});

export type ActivateQuarterRequest = z.infer<
  typeof activateQuarterRequestSchema
>;

export function createActivateQuarterRequestSchema(
  allowedQuarters: readonly [string, string],
) {
  return z.object({
    quarter: quarterSchema.refine(
      (q) => allowedQuarters.includes(q),
      "Only the current or next quarter can be activated.",
    ),
  });
}

export const walletCardQuarterViewSchema = z.object({
  quarter: quarterSchema,
  isActivated: z.boolean(),
  categories: z.array(
    z.object({
      category: z.enum(["GROCERIES", "DINING", "GAS", "TRAVEL"]),
      rateX100: z.number().int().positive(),
      capCents: z.number().int().positive().nullable().optional(),
    }),
  ),
});

export type WalletCardQuarterView = z.infer<typeof walletCardQuarterViewSchema>;

export const walletCardRotatingScheduleSchema = z.object({
  currentQuarter: walletCardQuarterViewSchema,
  nextQuarter: walletCardQuarterViewSchema,
});

export type WalletCardRotatingSchedule = z.infer<
  typeof walletCardRotatingScheduleSchema
>;

export const walletCardItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  cardId: z.string().uuid(),
  nickname: z.string().nullable().optional(),
  openedDate: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  paymentSettings: walletCardPaymentSettingsSchema.nullable().optional(),
  paidCycles: z.array(cycleYearMonthSchema).optional(),
  activatedQuarters: z.array(quarterSchema).optional(),
  rotatingQuarters: walletCardRotatingScheduleSchema.nullable().optional(),
  card: catalogCardSchema,
});

export type WalletCardItem = z.infer<typeof walletCardItemSchema>;

export const walletCardsResponseSchema = z.object({
  walletCards: z.array(walletCardItemSchema),
});

export type WalletCardsResponse = z.infer<typeof walletCardsResponseSchema>;
