import { describe, it, expect } from "vitest";
import {
  createSpendEntryRequestSchema,
  updateSpendEntryRequestSchema,
} from "./bonus.js";

describe("bonus schemas (US-07)", () => {
  it("AC1: accepts valid spend entry with positive amount and date", () => {
    const valid = createSpendEntryRequestSchema.safeParse({
      amountCents: 5000,
      date: "2026-03-15",
      note: "Grocery shopping",
    });
    expect(valid.success).toBe(true);
  });

  it("AC1: accepts negative amount representing a refund", () => {
    const refund = createSpendEntryRequestSchema.safeParse({
      amountCents: -2500,
      date: "2026-03-20",
      note: "Item returned",
    });
    expect(refund.success).toBe(true);
  });

  it("AC1: rejects note containing a card number via noCardNumber refinement", () => {
    const invalidNote = createSpendEntryRequestSchema.safeParse({
      amountCents: 1000,
      date: "2026-03-15",
      note: "Paid with card 4111111111111111",
    });
    expect(invalidNote.success).toBe(false);
    if (!invalidNote.success) {
      expect(invalidNote.error.issues[0]?.message).toBe(
        "Don't enter card numbers. SwipeWise only needs the card name.",
      );
    }
  });

  it("AC1: validates update spend entry payload", () => {
    const updateValid = updateSpendEntryRequestSchema.safeParse({
      amountCents: 7500,
      note: "Adjusted amount",
    });
    expect(updateValid.success).toBe(true);
  });
});
