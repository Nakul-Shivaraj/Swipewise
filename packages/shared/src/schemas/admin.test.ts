import { describe, it, expect } from "vitest";
import {
  adminCreateCardSchema,
  adminUpdateCardSchema,
  adminCreateStoreSchema,
  adminUpdateStoreSchema,
  adminAuditLogItemSchema,
} from "./admin.js";

describe("Admin Schemas (US-10)", () => {
  describe("adminCreateCardSchema", () => {
    it("accepts valid card data with cents and rateX100", () => {
      const valid = {
        name: "Sapphire Preferred Demo",
        issuer: "Chase Demo",
        artColor: "#1a365d",
        isDemo: true,
        annualFeeCents: 9500,
        baseRateX100: 100,
        programId: "11111111-1111-1111-1111-111111111111",
        rewardRules: [
          { category: "DINING", rateX100: 300, capCents: null },
          { category: "TRAVEL", rateX100: 200, capCents: 50000 },
        ],
        perks: [{ name: "Hotel Credit", amountCents: 5000, period: "ANNUAL" }],
        bonusOffer: {
          spendRequirementCents: 400000,
          windowMonths: 3,
          bonusPoints: 60000,
        },
      };
      const result = adminCreateCardSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects card numbers in name and issuer", () => {
      const invalid = {
        name: "4111111111111111",
        issuer: "Chase Demo",
        artColor: "#1a365d",
        annualFeeCents: 0,
        baseRateX100: 100,
        programId: "11111111-1111-1111-1111-111111111111",
        rewardRules: [],
      };
      const result = adminCreateCardSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain(
          "Don't enter card numbers",
        );
      }
    });

    it("rejects floats for money and rates", () => {
      const invalid = {
        name: "Demo Card",
        issuer: "Demo Bank",
        artColor: "#1a365d",
        annualFeeCents: 95.5,
        baseRateX100: 1.5,
        programId: "11111111-1111-1111-1111-111111111111",
        rewardRules: [{ category: "DINING", rateX100: 2.5 }],
      };
      const result = adminCreateCardSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("adminUpdateCardSchema", () => {
    it("accepts partial update of annual fee and rate", () => {
      const valid = {
        annualFeeCents: 12000,
        baseRateX100: 150,
      };
      const result = adminUpdateCardSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe("adminCreateStoreSchema", () => {
    it("accepts valid store with aliases", () => {
      const valid = {
        name: "Trader Joe Demo",
        category: "GROCERIES",
        aliases: ["TJ Demo", "Trader Joes Demo"],
      };
      const result = adminCreateStoreSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects card numbers in store name and aliases", () => {
      const invalid = {
        name: "4111111111111111",
        category: "GROCERIES",
        aliases: ["4111111111111111"],
      };
      const result = adminCreateStoreSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("adminUpdateStoreSchema", () => {
    it("accepts updating store name and aliases", () => {
      const valid = {
        name: "Trader Joe Updated",
        aliases: ["TJ Updated"],
      };
      const result = adminUpdateStoreSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe("adminAuditLogItemSchema", () => {
    it("validates audit log entry with before and after snapshots", () => {
      const valid = {
        id: "99999999-9999-9999-9999-999999999999",
        userId: "88888888-8888-8888-8888-888888888888",
        userEmail: "admin@swipewise.local",
        action: "CREATE_CARD",
        entityType: "CARD",
        entityId: "77777777-7777-7777-7777-777777777777",
        before: null,
        after: { name: "Demo Gold" },
        createdAt: "2026-11-12T18:00:00.000Z",
      };
      const result = adminAuditLogItemSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });
});
