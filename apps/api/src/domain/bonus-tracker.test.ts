import { describe, it, expect } from "vitest";
import { calculateBonusProgress } from "./bonus-tracker.js";

describe("calculateBonusProgress (US-07)", () => {
  const timeZone = "America/Los_Angeles";

  it("AC3: calculates deadline as open date + window in months", () => {
    const result = calculateBonusProgress({
      now: new Date("2026-02-15T12:00:00Z"),
      timeZone,
      openedDate: "2026-01-15",
      windowMonths: 3,
      requiredSpendCents: 300000,
      spendEntries: [],
    });

    expect(result.deadline).toBe("2026-04-15");
    expect(result.daysLeft).toBe(59);
    expect(result.status).toBe("In progress");
  });

  it("AC3: clamps month-end deadlines when day does not exist (Jan 31 + 1 month = Feb 28 in non-leap year)", () => {
    const result = calculateBonusProgress({
      now: new Date("2026-02-01T12:00:00Z"),
      timeZone,
      openedDate: "2026-01-31",
      windowMonths: 1,
      requiredSpendCents: 100000,
      spendEntries: [],
    });

    expect(result.deadline).toBe("2026-02-28");
  });

  it("AC3: clamps month-end deadlines in leap year (Jan 31 + 1 month = Feb 29 in 2024)", () => {
    const result = calculateBonusProgress({
      now: new Date("2024-02-01T12:00:00Z"),
      timeZone,
      openedDate: "2024-01-31",
      windowMonths: 1,
      requiredSpendCents: 100000,
      spendEntries: [],
    });

    expect(result.deadline).toBe("2024-02-29");
  });

  it("AC1 & AC4: calculates spending and reduces progress with refunds", () => {
    const result = calculateBonusProgress({
      now: new Date("2026-02-15T12:00:00Z"),
      timeZone,
      openedDate: "2026-01-01",
      windowMonths: 3,
      requiredSpendCents: 300000, // $3,000
      spendEntries: [
        { amountCents: 150000, date: "2026-01-10" }, // $1,500
        { amountCents: 50000, date: "2026-01-20" }, // $500
        { amountCents: -20000, date: "2026-01-25" }, // -$200 refund
      ],
    });

    expect(result.spentCents).toBe(180000); // $1,800
    expect(result.remainingCents).toBe(120000); // $1,200
    expect(result.status).toBe("In progress");
  });

  it("AC1 & AC3: ignores spending dated after the deadline", () => {
    const result = calculateBonusProgress({
      now: new Date("2026-04-10T12:00:00Z"),
      timeZone,
      openedDate: "2026-01-01",
      windowMonths: 3, // deadline: 2026-04-01
      requiredSpendCents: 300000,
      spendEntries: [
        { amountCents: 200000, date: "2026-02-01" }, // eligible
        { amountCents: 150000, date: "2026-04-05" }, // AFTER deadline, should NOT count
      ],
    });

    expect(result.spentCents).toBe(200000);
    expect(result.remainingCents).toBe(100000);
    expect(result.status).toBe("Missed");
  });

  it("AC4: marks status as Earned once spend requirement is reached", () => {
    const result = calculateBonusProgress({
      now: new Date("2026-02-15T12:00:00Z"),
      timeZone,
      openedDate: "2026-01-01",
      windowMonths: 3,
      requiredSpendCents: 300000,
      spendEntries: [
        { amountCents: 200000, date: "2026-01-10" },
        { amountCents: 120000, date: "2026-02-01" },
      ],
    });

    expect(result.spentCents).toBe(320000);
    expect(result.remainingCents).toBe(0);
    expect(result.status).toBe("Earned");
  });

  it("AC4: marks status as Missed if deadline has passed without meeting spend requirement", () => {
    const result = calculateBonusProgress({
      now: new Date("2026-05-01T12:00:00Z"),
      timeZone,
      openedDate: "2026-01-01",
      windowMonths: 3, // deadline: 2026-04-01
      requiredSpendCents: 300000,
      spendEntries: [{ amountCents: 100000, date: "2026-02-01" }],
    });

    expect(result.status).toBe("Missed");
    expect(result.daysLeft).toBe(0);
  });

  it("AC3: handles missing open date and indicates user should add one", () => {
    const result = calculateBonusProgress({
      now: new Date("2026-02-15T12:00:00Z"),
      timeZone,
      openedDate: null,
      windowMonths: 3,
      requiredSpendCents: 300000,
      spendEntries: [{ amountCents: 50000, date: "2026-02-01" }],
    });

    expect(result.requiresOpenDate).toBe(true);
    expect(result.deadline).toBeNull();
    expect(result.daysLeft).toBeNull();
  });

  it("handles missing open date when spend already exceeds requirement", () => {
    const result = calculateBonusProgress({
      now: new Date("2026-02-15T12:00:00Z"),
      timeZone: "invalid-zone",
      openedDate: null,
      windowMonths: 3,
      requiredSpendCents: 100000,
      spendEntries: [{ amountCents: 150000, date: "2026-02-01" }],
    });

    expect(result.requiresOpenDate).toBe(true);
    expect(result.status).toBe("Earned");
  });

  it("accepts JS Date objects for openedDate and entry date", () => {
    const result = calculateBonusProgress({
      now: new Date("2026-02-15T12:00:00Z"),
      openedDate: new Date("2026-01-01T08:00:00Z"),
      windowMonths: 3,
      requiredSpendCents: 200000,
      spendEntries: [
        { amountCents: 200000, date: new Date("2026-01-15T08:00:00Z") },
      ],
    });

    expect(result.deadline).toBe("2026-04-01");
    expect(result.status).toBe("Earned");
  });
});
