import { describe, it, expect } from "vitest";
import {
  addWalletCardRequestSchema,
  markCyclePaidRequestSchema,
  updatePaymentSettingsRequestSchema,
  updateWalletCardRequestSchema,
} from "./wallet.js";

describe("Wallet Schemas (US-02 / Issue #11)", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  it("AC1: accepts a valid add card request with optional nickname and open date", () => {
    const valid = {
      cardId: validUuid,
      nickname: "Everyday Groceries",
      openedDate: "2024-01-15",
    };
    const parsed = addWalletCardRequestSchema.parse(valid);
    expect(parsed.cardId).toBe(validUuid);
    expect(parsed.nickname).toBe("Everyday Groceries");
    expect(parsed.openedDate).toBe("2024-01-15");
  });

  it("AC1: accepts add card request without nickname and open date", () => {
    const valid = {
      cardId: validUuid,
    };
    const parsed = addWalletCardRequestSchema.parse(valid);
    expect(parsed.cardId).toBe(validUuid);
    expect(parsed.nickname).toBeUndefined();
    expect(parsed.openedDate).toBeUndefined();
  });

  it("AC3: rejects nickname containing a valid card number (Luhn check)", () => {
    const withCardNumber = {
      cardId: validUuid,
      nickname: "Card 4111111111111111",
    };
    const result = addWalletCardRequestSchema.safeParse(withCardNumber);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Don't enter card numbers. SwipeWise only needs the card name.",
      );
    }
  });

  it("AC2: validates update nickname schema and rejects card numbers", () => {
    const validUpdate = { nickname: "Travel Card" };
    expect(updateWalletCardRequestSchema.parse(validUpdate).nickname).toBe(
      "Travel Card",
    );

    const invalidUpdate = { nickname: "Card 4111111111111111" };
    const result = updateWalletCardRequestSchema.safeParse(invalidUpdate);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Don't enter card numbers. SwipeWise only needs the card name.",
      );
    }
  });

  it("US-08 AC1 (Issue #20): validates dueDay as a whole number 1–31 and cycleYearMonth as YYYY-MM", () => {
    expect(
      updatePaymentSettingsRequestSchema.parse({ dueDay: 1, isAutopay: false }),
    ).toEqual({ dueDay: 1, isAutopay: false });
    expect(
      updatePaymentSettingsRequestSchema.parse({ dueDay: 31, isAutopay: true }),
    ).toEqual({ dueDay: 31, isAutopay: true });

    expect(
      updatePaymentSettingsRequestSchema.safeParse({ dueDay: 0 }).success,
    ).toBe(false);
    expect(
      updatePaymentSettingsRequestSchema.safeParse({ dueDay: 32 }).success,
    ).toBe(false);
    expect(
      updatePaymentSettingsRequestSchema.safeParse({ dueDay: 15.5 }).success,
    ).toBe(false);

    expect(
      markCyclePaidRequestSchema.parse({ cycleYearMonth: "2026-11" }),
    ).toEqual({ cycleYearMonth: "2026-11" });
    expect(
      markCyclePaidRequestSchema.safeParse({ cycleYearMonth: "2026-13" })
        .success,
    ).toBe(false);
  });
});
