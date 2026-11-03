import { describe, it, expect } from "vitest";
import { storeSearchQuerySchema } from "./stores.js";

describe("storeSearchQuerySchema (US-04 / Issue #13)", () => {
  it("trims valid search text between 1 and 100 characters", () => {
    const parsed = storeSearchQuerySchema.safeParse({
      q: "  Safeway  ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.q).toBe("Safeway");
    }

    const singleChar = storeSearchQuerySchema.safeParse({ q: "s" });
    expect(singleChar.success).toBe(true);

    const maxChars = storeSearchQuerySchema.safeParse({
      q: "a".repeat(100),
    });
    expect(maxChars.success).toBe(true);
  });

  it("rejects empty, whitespace-only, or >100 character search strings", () => {
    expect(storeSearchQuerySchema.safeParse({ q: "" }).success).toBe(false);
    expect(storeSearchQuerySchema.safeParse({ q: "   " }).success).toBe(false);
    expect(
      storeSearchQuerySchema.safeParse({ q: "a".repeat(101) }).success,
    ).toBe(false);
  });

  it("rejects search strings that contain a Luhn-valid card number (AGENTS.md §12)", () => {
    const parsed = storeSearchQuerySchema.safeParse({
      q: "4532015112830366",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(
        "Don't enter card numbers. SwipeWise only needs the card name.",
      );
    }
  });
});
