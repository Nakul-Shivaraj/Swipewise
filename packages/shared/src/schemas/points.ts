import { z } from "zod";

export const MAX_POINTS_BALANCE = 1_000_000_000;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInMonth(year: number, month: number): number {
  const days = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return days[month - 1] ?? 0;
}

export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const parts = dateStr.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 0;
  const day = parts[2] ?? 0;

  if (year < 1900 || year > 9999) {
    return false;
  }
  if (month < 1 || month > 12) {
    return false;
  }
  const maxDay = getDaysInMonth(year, month);
  return day >= 1 && day <= maxDay;
}

export const upsertPointsBalanceRequestSchema = z.object({
  pointsBalance: z
    .number()
    .int("Points balance must be a whole number.")
    .min(0, "Points balance must be between 0 and 1,000,000,000.")
    .max(
      MAX_POINTS_BALANCE,
      "Points balance must be between 0 and 1,000,000,000.",
    ),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD.")
    .refine(isValidCalendarDate, "Enter a valid calendar date."),
});

export type UpsertPointsBalanceRequest = z.infer<
  typeof upsertPointsBalanceRequestSchema
>;

export const programPointsBalanceItemSchema = z.object({
  programId: z.string().uuid(),
  programName: z.string(),
  centsPer100Points: z.number().int(),
  balanceId: z.string().uuid().nullable(),
  pointsBalance: z.number().int().nullable(),
  valueCents: z.number().int().nullable(),
  expiryDate: z.string().nullable(),
});

export type ProgramPointsBalanceItem = z.infer<
  typeof programPointsBalanceItemSchema
>;

export const pointsBalancesResponseSchema = z.object({
  programs: z.array(programPointsBalanceItemSchema),
});

export type PointsBalancesResponse = z.infer<
  typeof pointsBalancesResponseSchema
>;

export const upsertPointsBalanceResponseSchema = z.object({
  programBalance: programPointsBalanceItemSchema,
});

export type UpsertPointsBalanceResponse = z.infer<
  typeof upsertPointsBalanceResponseSchema
>;
