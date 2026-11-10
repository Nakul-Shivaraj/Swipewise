import { describe, it, expect } from "vitest";
import {
  resolvePerkPeriodWindow,
  calculatePerkUsageLeft,
  generatePerkEndingRemindersForCards,
  buildPerkEndingDedupeKey,
  PerkReminderCardInput,
} from "./perks.js";

describe("perks domain (US-06 / Issue #21)", () => {
  describe("resolvePerkPeriodWindow", () => {
    it("AC3: resolves MONTHLY period window with month-end boundaries", () => {
      // 2026-11-15 in America/Los_Angeles
      const nowNov = new Date("2026-11-15T12:00:00Z");
      const windowNov = resolvePerkPeriodWindow({
        now: nowNov,
        timeZone: "America/Los_Angeles",
        period: "MONTHLY",
      });

      expect(windowNov.periodKey).toBe("2026-11");
      expect(windowNov.startDate).toBe("2026-11-01");
      expect(windowNov.endDate).toBe("2026-11-30");
      expect(windowNov.daysLeft).toBe(15);
    });

    it("AC3: handles leap year Feb 29 month-end date", () => {
      // 2028 is a leap year; Feb 28, 2028
      const nowFebLeap = new Date("2028-02-28T12:00:00Z");
      const windowLeap = resolvePerkPeriodWindow({
        now: nowFebLeap,
        timeZone: "America/Los_Angeles",
        period: "MONTHLY",
      });

      expect(windowLeap.periodKey).toBe("2028-02");
      expect(windowLeap.endDate).toBe("2028-02-29");
      expect(windowLeap.daysLeft).toBe(1);

      // On Feb 29 leap day
      const nowLeapDay = new Date("2028-02-29T12:00:00Z");
      const windowLeapDay = resolvePerkPeriodWindow({
        now: nowLeapDay,
        timeZone: "America/Los_Angeles",
        period: "MONTHLY",
      });
      expect(windowLeapDay.daysLeft).toBe(0);

      // Non-leap year Feb 2026
      const nowFebNonLeap = new Date("2026-02-28T12:00:00Z");
      const windowNonLeap = resolvePerkPeriodWindow({
        now: nowFebNonLeap,
        timeZone: "America/Los_Angeles",
        period: "MONTHLY",
      });
      expect(windowNonLeap.endDate).toBe("2026-02-28");
      expect(windowNonLeap.daysLeft).toBe(0);
    });

    it("AC3: resets period at period boundaries (month transition)", () => {
      // Last second of Nov 30 in LA: 2026-11-30 23:59:59 (which is 2026-12-01T07:59:59Z)
      const lastSecondNov = new Date("2026-12-01T07:59:59Z");
      const windowNov = resolvePerkPeriodWindow({
        now: lastSecondNov,
        timeZone: "America/Los_Angeles",
        period: "MONTHLY",
      });
      expect(windowNov.periodKey).toBe("2026-11");

      // First second of Dec 1 in LA: 2026-12-01 00:00:00 (which is 2026-12-01T08:00:00Z)
      const firstSecondDec = new Date("2026-12-01T08:00:00Z");
      const windowDec = resolvePerkPeriodWindow({
        now: firstSecondDec,
        timeZone: "America/Los_Angeles",
        period: "MONTHLY",
      });
      expect(windowDec.periodKey).toBe("2026-12");
      expect(windowDec.startDate).toBe("2026-12-01");
      expect(windowDec.endDate).toBe("2026-12-31");
    });

    it("AC3: resolves QUARTERLY periods across quarter boundaries", () => {
      // Q1: March 31
      const q1End = new Date("2026-03-31T15:00:00Z");
      const windowQ1 = resolvePerkPeriodWindow({
        now: q1End,
        timeZone: "America/Los_Angeles",
        period: "QUARTERLY",
      });
      expect(windowQ1.periodKey).toBe("2026-Q1");
      expect(windowQ1.startDate).toBe("2026-01-01");
      expect(windowQ1.endDate).toBe("2026-03-31");

      // Q2: April 1
      const q2Start = new Date("2026-04-01T15:00:00Z");
      const windowQ2 = resolvePerkPeriodWindow({
        now: q2Start,
        timeZone: "America/Los_Angeles",
        period: "QUARTERLY",
      });
      expect(windowQ2.periodKey).toBe("2026-Q2");
      expect(windowQ2.startDate).toBe("2026-04-01");
      expect(windowQ2.endDate).toBe("2026-06-30");
    });

    it("AC3: resolves SEMIANNUAL and ANNUAL periods", () => {
      // H1 vs H2
      const h1Date = new Date("2026-06-30T15:00:00Z");
      const windowH1 = resolvePerkPeriodWindow({
        now: h1Date,
        timeZone: "America/Los_Angeles",
        period: "SEMIANNUAL",
      });
      expect(windowH1.periodKey).toBe("2026-H1");
      expect(windowH1.startDate).toBe("2026-01-01");
      expect(windowH1.endDate).toBe("2026-06-30");

      const h2Date = new Date("2026-07-01T15:00:00Z");
      const windowH2 = resolvePerkPeriodWindow({
        now: h2Date,
        timeZone: "America/Los_Angeles",
        period: "SEMIANNUAL",
      });
      expect(windowH2.periodKey).toBe("2026-H2");
      expect(windowH2.startDate).toBe("2026-07-01");
      expect(windowH2.endDate).toBe("2026-12-31");

      // Annual
      const annualDate = new Date("2026-11-15T15:00:00Z");
      const windowAnnual = resolvePerkPeriodWindow({
        now: annualDate,
        timeZone: "America/Los_Angeles",
        period: "ANNUAL",
      });
      expect(windowAnnual.periodKey).toBe("2026");
      expect(windowAnnual.startDate).toBe("2026-01-01");
      expect(windowAnnual.endDate).toBe("2026-12-31");
    });
  });

  describe("calculatePerkUsageLeft", () => {
    it("AC1: calculates used and left amount in cents correctly", () => {
      const result = calculatePerkUsageLeft(1500, 500);
      expect(result.amountCents).toBe(1500);
      expect(result.usedCents).toBe(500);
      expect(result.leftCents).toBe(1000);
      expect(result.isUsed).toBe(false);
    });

    it("AC2: bounds usage so it cannot exceed perk amount", () => {
      expect(() => calculatePerkUsageLeft(1500, 2000)).toThrow(
        "Usage cannot exceed perk amount",
      );
    });
  });

  describe("generatePerkEndingRemindersForCards", () => {
    const samplePerkCard: PerkReminderCardInput = {
      walletCardId: "wallet-card-1",
      userId: "user-1",
      cardDisplayName: "Harbor Travel Plus",
      perkId: "perk-ride-15",
      perkName: "Ride credit",
      amountCents: 1500,
      period: "MONTHLY",
      periodKey: "2026-11",
      endDate: "2026-11-30",
      usedCents: 0,
    };

    it("AC4: creates a reminder 5 days before period ends if money is left", () => {
      // 5 days before Nov 30 is Nov 25
      const reminders = generatePerkEndingRemindersForCards({
        userId: "user-1",
        localDate: "2026-11-25",
        cards: [samplePerkCard],
      });

      expect(reminders).toHaveLength(1);
      expect(reminders[0]).toMatchObject({
        userId: "user-1",
        type: "PERK_ENDING",
        title: "Ride credit ends in 5 days",
        body: "Harbor Travel Plus $15.00 ride credit resets soon.",
        dueDate: "2026-11-30",
        dedupeKey: "PERK_ENDING:wallet-card-1:perk-ride-15:2026-11",
      });
    });

    it("AC4: does not create reminder earlier than 5 days before period end", () => {
      const reminders = generatePerkEndingRemindersForCards({
        userId: "user-1",
        localDate: "2026-11-20",
        cards: [samplePerkCard],
      });

      expect(reminders).toHaveLength(0);
    });

    it("AC4: does not create reminder if all money has been used", () => {
      const fullyUsedCard: PerkReminderCardInput = {
        ...samplePerkCard,
        usedCents: 1500,
      };

      const reminders = generatePerkEndingRemindersForCards({
        userId: "user-1",
        localDate: "2026-11-25",
        cards: [fullyUsedCard],
      });

      expect(reminders).toHaveLength(0);
    });

    it("AC4: builds unique and idempotent dedupeKey per card, perk, and period", () => {
      const key = buildPerkEndingDedupeKey(
        "wallet-card-1",
        "perk-ride-15",
        "2026-11",
      );
      expect(key).toBe("PERK_ENDING:wallet-card-1:perk-ride-15:2026-11");
    });
  });
});
