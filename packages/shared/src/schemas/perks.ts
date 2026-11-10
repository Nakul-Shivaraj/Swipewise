import { z } from "zod";

export const PERK_PERIODS = [
  "MONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
] as const;

export type PerkPeriodName = (typeof PERK_PERIODS)[number];

export const perkPeriodSchema = z.enum(PERK_PERIODS);

export const markPerkUsageSchema = z
  .object({
    usedCents: z
      .number()
      .int("usedCents must be an integer")
      .min(0, "usedCents cannot be negative")
      .optional(),
    isFull: z.boolean().optional(),
  })
  .refine((data) => data.usedCents !== undefined || data.isFull !== undefined, {
    message: "Either usedCents or isFull must be provided",
  });

export type MarkPerkUsageRequest = z.infer<typeof markPerkUsageSchema>;

export const walletCardPerkItemSchema = z.object({
  id: z.string(),
  perkId: z.string(),
  walletCardId: z.string(),
  cardName: z.string(),
  cardNickname: z.string().nullable().optional(),
  cardArtColor: z.string().optional(),
  perkName: z.string(),
  amountCents: z.number().int().min(0),
  period: perkPeriodSchema,
  periodKey: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  usedCents: z.number().int().min(0),
  leftCents: z.number().int().min(0),
  daysLeft: z.number().int().min(0),
  isUsed: z.boolean(),
});

export type WalletCardPerkItem = z.infer<typeof walletCardPerkItemSchema>;

export const walletCardPerksResponseSchema = z.object({
  perks: z.array(walletCardPerkItemSchema),
  summary: z
    .object({
      totalAmountCents: z.number().int().min(0),
      totalUsedCents: z.number().int().min(0),
      totalLeftCents: z.number().int().min(0),
    })
    .optional(),
});

export type WalletCardPerksResponse = z.infer<
  typeof walletCardPerksResponseSchema
>;
