import { describe, it, expect } from "vitest";
import { upsertPointsBalanceRequestSchema } from "./points.js";

describe("Points balance Zod schemas (US-09 / Issue #24)", () => {
  it("accepts a whole number balance from 0 to 1,000,000,000 and a valid calendar expiryDate", () => {
    expect(
      upsertPointsBalanceRequestSchema.safeParse({
        pointsBalance: 0,
        expiryDate: "2026-12-31",
      }).success,
    ).toBe(true);

    expect(
      upsertPointsBalanceRequestSchema.safeParse({
        pointsBalance: 1_000_000_000,
        expiryDate: "2028-02-29",
      }).success,
    ).toBe(true);
  });

  it("rejects negative, fractional, or > 1,000,000,000 points balances", () => {
    expect(
      upsertPointsBalanceRequestSchema.safeParse({
        pointsBalance: -1,
        expiryDate: "2026-12-31",
      }).success,
    ).toBe(false);

    expect(
      upsertPointsBalanceRequestSchema.safeParse({
        pointsBalance: 333.5,
        expiryDate: "2026-12-31",
      }).success,
    ).toBe(false);

    expect(
      upsertPointsBalanceRequestSchema.safeParse({
        pointsBalance: 1_000_000_001,
        expiryDate: "2026-12-31",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid date strings and impossible calendar dates", () => {
    expect(
      upsertPointsBalanceRequestSchema.safeParse({
        pointsBalance: 10000,
        expiryDate: "12/31/2026",
      }).success,
    ).toBe(false);

    expect(
      upsertPointsBalanceRequestSchema.safeParse({
        pointsBalance: 10000,
        expiryDate: "2026-02-29",
      }).success,
    ).toBe(false);

    expect(
      upsertPointsBalanceRequestSchema.safeParse({
        pointsBalance: 10000,
        expiryDate: "2026-13-01",
      }).success,
    ).toBe(false);
  });
});
