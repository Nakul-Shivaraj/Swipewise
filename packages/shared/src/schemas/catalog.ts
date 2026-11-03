import { z } from "zod";

export const catalogRateSchema = z.object({
  category: z.enum(["GROCERIES", "DINING", "GAS", "TRAVEL"]),
  rateX100: z.number().int().positive(),
  capCents: z.number().int().positive().nullable().optional(),
});

export type CatalogRate = z.infer<typeof catalogRateSchema>;

export const catalogCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  issuer: z.string().min(1),
  artColor: z.string().min(1),
  isDemo: z.boolean(),
  annualFeeCents: z.number().int().nonnegative(),
  baseRateX100: z.number().int().positive(),
  program: z.object({
    name: z.string().min(1),
    centsPer100Points: z.number().int().positive(),
  }),
  rates: z.array(catalogRateSchema),
});

export type CatalogCard = z.infer<typeof catalogCardSchema>;

export const catalogCardsResponseSchema = z.object({
  cards: z.array(catalogCardSchema),
});

export type CatalogCardsResponse = z.infer<typeof catalogCardsResponseSchema>;
