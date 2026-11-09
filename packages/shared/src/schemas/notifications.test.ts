import { describe, it, expect } from "vitest";
import {
  REMINDER_TYPES,
  reminderTypeSchema,
  notificationItemSchema,
  updateNotificationPreferencesRequestSchema,
} from "./notifications.js";

describe("Notifications & Reminder Preferences Schemas (US-05..09 / Issue #19)", () => {
  it("defines all 4 reminder types: PAYMENT_DUE, PERK_ENDING, ROTATING_CATEGORY, POINTS_EXPIRY", () => {
    expect(REMINDER_TYPES).toEqual([
      "PAYMENT_DUE",
      "PERK_ENDING",
      "ROTATING_CATEGORY",
      "POINTS_EXPIRY",
    ]);

    for (const type of REMINDER_TYPES) {
      expect(reminderTypeSchema.safeParse(type).success).toBe(true);
    }
    expect(reminderTypeSchema.safeParse("INVALID_TYPE").success).toBe(false);
  });

  it("validates notificationItemSchema and rejects Luhn-valid card numbers in title or body", () => {
    const validItem = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      userId: "123e4567-e89b-12d3-a456-426614174001",
      type: "PAYMENT_DUE",
      title: "Payment due in 5 days",
      body: "Mint Everyday payment is due soon.",
      dueDate: "2026-11-15",
      dedupeKey: "PAYMENT_DUE:user-1:2026-11-15",
      dismissedAt: null,
      createdAt: "2026-11-10T09:00:00.000Z",
    };

    expect(notificationItemSchema.safeParse(validItem).success).toBe(true);

    const withCardNumber = {
      ...validItem,
      body: "Card 4532015112830366 due soon",
    };
    const badRes = notificationItemSchema.safeParse(withCardNumber);
    expect(badRes.success).toBe(false);
  });

  it("validates single and bulk notification preference updates", () => {
    const single = updateNotificationPreferencesRequestSchema.safeParse({
      type: "PERK_ENDING",
      enabled: false,
    });
    expect(single.success).toBe(true);

    const bulk = updateNotificationPreferencesRequestSchema.safeParse({
      preferences: [
        { type: "PAYMENT_DUE", enabled: true },
        { type: "POINTS_EXPIRY", enabled: false },
      ],
    });
    expect(bulk.success).toBe(true);

    const invalid = updateNotificationPreferencesRequestSchema.safeParse({
      preferences: [],
    });
    expect(invalid.success).toBe(false);
  });
});
