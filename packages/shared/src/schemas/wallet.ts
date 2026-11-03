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

export const walletCardItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  cardId: z.string().uuid(),
  nickname: z.string().nullable().optional(),
  openedDate: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  card: catalogCardSchema,
});

export type WalletCardItem = z.infer<typeof walletCardItemSchema>;

export const walletCardsResponseSchema = z.object({
  walletCards: z.array(walletCardItemSchema),
});

export type WalletCardsResponse = z.infer<typeof walletCardsResponseSchema>;
