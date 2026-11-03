import { describe, it, expect } from "vitest";
import { recommendationsQuerySchema } from "./recommendations.js";

describe("recommendationsQuerySchema (US-03 / Issue #12)", () => {
  it("validates valid category and defaults amountCents to 10000 ($100)", () => {
    const parsed = recommendationsQuerySchema.safeParse({
      category: "GROCERIES",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({
        category: "GROCERIES",
        amountCents: 10000,
      });
    }
  });

  it("accepts whole numbers from 1 to 100,000,000 as strings or numbers", () => {
    const minParsed = recommendationsQuerySchema.safeParse({
      category: "DINING",
      amountCents: "1",
    });
    expect(minParsed.success).toBe(true);
    if (minParsed.success) {
      expect(minParsed.data.amountCents).toBe(1);
    }

    const maxParsed = recommendationsQuerySchema.safeParse({
      category: "TRAVEL",
      amountCents: 100_000_000,
    });
    expect(maxParsed.success).toBe(true);
    if (maxParsed.success) {
      expect(maxParsed.data.amountCents).toBe(100_000_000);
    }
  });

  it("rejects invalid categories and out-of-range or fractional amountCents", () => {
    expect(
      recommendationsQuerySchema.safeParse({ category: "SHOPPING" }).success,
    ).toBe(false);
    expect(
      recommendationsQuerySchema.safeParse({
        category: "GROCERIES",
        amountCents: "0",
      }).success,
    ).toBe(false);
    expect(
      recommendationsQuerySchema.safeParse({
        category: "GROCERIES",
        amountCents: "-100",
      }).success,
    ).toBe(false);
    expect(
      recommendationsQuerySchema.safeParse({
        category: "GROCERIES",
        amountCents: "100000001",
      }).success,
    ).toBe(false);
    expect(
      recommendationsQuerySchema.safeParse({
        category: "GROCERIES",
        amountCents: "10.5",
      }).success,
    ).toBe(false);
    expect(
      recommendationsQuerySchema.safeParse({
        category: "GROCERIES",
        amountCents: "abc",
      }).success,
    ).toBe(false);
  });
});
