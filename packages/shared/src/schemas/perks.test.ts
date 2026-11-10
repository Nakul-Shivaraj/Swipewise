import { describe, it, expect } from "vitest";
import {
  perkPeriodSchema,
  markPerkUsageSchema,
  walletCardPerkItemSchema,
  walletCardPerksResponseSchema,
} from "./perks.js";

describe("Perks Schemas (US-06 / Issue #21)", () => {
  it("AC3: validates perk periods: MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL", () => {
    expect(perkPeriodSchema.safeParse("MONTHLY").success).toBe(true);
    expect(perkPeriodSchema.safeParse("QUARTERLY").success).toBe(true);
    expect(perkPeriodSchema.safeParse("SEMIANNUAL").success).toBe(true);
    expect(perkPeriodSchema.safeParse("ANNUAL").success).toBe(true);
    expect(perkPeriodSchema.safeParse("WEEKLY").success).toBe(false);
  });

  it("AC2: validates mark perk usage schema (partial and full)", () => {
    // Partial usage
    const partial = markPerkUsageSchema.safeParse({ usedCents: 500 });
    expect(partial.success).toBe(true);
    if (partial.success) {
      expect(partial.data.usedCents).toBe(500);
    }

    // Full usage (explicit flag or zero or positive cents)
    const full = markPerkUsageSchema.safeParse({ isFull: true });
    expect(full.success).toBe(true);

    // Negative cents rejected
    const negative = markPerkUsageSchema.safeParse({ usedCents: -100 });
    expect(negative.success).toBe(false);

    // Reject non-integer cents
    const float = markPerkUsageSchema.safeParse({ usedCents: 12.5 });
    expect(float.success).toBe(false);
  });

  it("AC1: validates wallet card perk item and response schema", () => {
    const sampleItem = {
      id: "perk-1",
      perkId: "perk-1",
      walletCardId: "wallet-card-1",
      cardName: "Harbor Travel Plus",
      perkName: "Ride credit",
      amountCents: 1500,
      period: "MONTHLY",
      periodKey: "2026-11",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      usedCents: 500,
      leftCents: 1000,
      daysLeft: 5,
      isUsed: false,
    };

    expect(walletCardPerkItemSchema.safeParse(sampleItem).success).toBe(true);

    const sampleResponse = {
      perks: [sampleItem],
      summary: {
        totalAmountCents: 1500,
        totalUsedCents: 500,
        totalLeftCents: 1000,
      },
    };

    expect(
      walletCardPerksResponseSchema.safeParse(sampleResponse).success,
    ).toBe(true);
  });
});
