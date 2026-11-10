import { describe, it, expect } from "vitest";
import {
  calculatePointsValueCents,
  generatePointsExpiryRemindersForBalances,
  createPointsExpiryReminderGenerator,
  PointsBalanceReminderInput,
} from "./points-expiry.js";
import {
  createReminderGeneratorRegistry,
  filterNewReminderCandidates,
  generateRemindersForUser,
} from "./reminders.js";

describe("Points expiry alerts domain (US-09 / Issue #24)", () => {
  const USER_ID = "11111111-1111-4111-8111-111111111111";
  const BALANCE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const PROGRAM_ID = "pppppppp-pppp-4ppp-8ppp-pppppppppppp";

  function makeBalance(
    overrides: Partial<PointsBalanceReminderInput> = {},
  ): PointsBalanceReminderInput {
    return {
      balanceId: BALANCE_ID,
      userId: USER_ID,
      programId: PROGRAM_ID,
      programName: "Harbor Points",
      centsPer100Points: 125,
      pointsBalance: 10000,
      expiryDate: "2026-12-31",
      ...overrides,
    };
  }

  describe("AC2: Dollar value maths (whole cents, round half up once)", () => {
    it("calculates 10,000 points at 125 cents per 100 points as 12,500 cents ($125.00)", () => {
      expect(calculatePointsValueCents(10000, 125)).toBe(12500);
    });

    it("calculates a cash-back program at 100 cents per 100 points (5,000 points -> 5,000 cents / $50.00)", () => {
      expect(calculatePointsValueCents(5000, 100)).toBe(5000);
    });

    it("rounds fractional cents half up once (333 points at 125 -> 416 cents; 334 points at 125 -> 418 cents)", () => {
      // 333 * 125 / 100 = 416.25 -> 416
      expect(calculatePointsValueCents(333, 125)).toBe(416);
      // 334 * 125 / 100 = 417.5 -> 418 (round half up)
      expect(calculatePointsValueCents(334, 125)).toBe(418);
    });

    it("returns 0 cents for 0 points", () => {
      expect(calculatePointsValueCents(0, 150)).toBe(0);
    });
  });

  describe("AC3: Reminders 30 days and 7 days before expiry in user's time zone", () => {
    it("creates reminders 30 days before (2026-12-01) and 7 days before (2026-12-24) expiry 2026-12-31", () => {
      const balance = makeBalance({ expiryDate: "2026-12-31" });

      // 31 days before (2026-11-30) -> no reminder
      expect(
        generatePointsExpiryRemindersForBalances({
          userId: USER_ID,
          localDate: "2026-11-30",
          balances: [balance],
        }),
      ).toHaveLength(0);

      // Exactly 30 days before (2026-12-01) -> :30 reminder
      const thirtyDays = generatePointsExpiryRemindersForBalances({
        userId: USER_ID,
        localDate: "2026-12-01",
        balances: [balance],
      });
      expect(thirtyDays).toHaveLength(1);
      expect(thirtyDays[0]).toMatchObject({
        userId: USER_ID,
        type: "POINTS_EXPIRY",
        title: "Points expire in 30 days",
        dueDate: "2026-12-31",
        dedupeKey: `POINTS_EXPIRY:${BALANCE_ID}:2026-12-31:30`,
      });
      expect(thirtyDays[0]?.body).toContain("Harbor Points");
      expect(thirtyDays[0]?.body).toContain("$125.00");

      // Exactly 7 days before (2026-12-24) -> :7 reminder
      const sevenDays = generatePointsExpiryRemindersForBalances({
        userId: USER_ID,
        localDate: "2026-12-24",
        balances: [balance],
      });
      expect(sevenDays).toHaveLength(1);
      expect(sevenDays[0]).toMatchObject({
        userId: USER_ID,
        type: "POINTS_EXPIRY",
        title: "Points expire in 7 days",
        dueDate: "2026-12-31",
        dedupeKey: `POINTS_EXPIRY:${BALANCE_ID}:2026-12-31:7`,
      });
    });

    it("evaluates the 30-day window in the user's IANA time zone via generateRemindersForUser", async () => {
      const balance = makeBalance({ expiryDate: "2026-12-31" });
      const registry = createReminderGeneratorRegistry();
      registry.register(
        "POINTS_EXPIRY",
        createPointsExpiryReminderGenerator(async () => [balance]),
      );

      // 2026-11-30T20:00:00Z is 2026-11-30 in America/Los_Angeles (31 days before)
      // but 2026-12-01 in Pacific/Auckland (30 days before)
      const instant = new Date("2026-11-30T20:00:00.000Z");

      const laResult = await generateRemindersForUser({
        user: { id: USER_ID, timeZone: "America/Los_Angeles" },
        savedPreferences: [],
        registry,
        now: instant,
      });
      expect(laResult).toHaveLength(0);

      const nzResult = await generateRemindersForUser({
        user: { id: USER_ID, timeZone: "Pacific/Auckland" },
        savedPreferences: [],
        registry,
        now: instant,
      });
      expect(nzResult).toHaveLength(1);
      expect(nzResult[0]?.dedupeKey).toBe(
        `POINTS_EXPIRY:${BALANCE_ID}:2026-12-31:30`,
      );
    });
  });

  describe("Idempotency, missed-day catch-up, expiry changes, zero balance, and preference toggle", () => {
    it("running the job twice produces no duplicates, and a missed day still gets caught up", async () => {
      const balance = makeBalance({ expiryDate: "2026-12-31" });
      const registry = createReminderGeneratorRegistry();
      registry.register(
        "POINTS_EXPIRY",
        createPointsExpiryReminderGenerator(async () => [balance]),
      );

      // Missed 2026-12-01 (30 days before); runs on 2026-12-05 (26 days before)
      const missedDayInstant = new Date("2026-12-05T18:00:00.000Z");
      const existingDedupeKeys = new Set<string>();

      const run1 = await generateRemindersForUser({
        user: { id: USER_ID, timeZone: "America/Los_Angeles" },
        savedPreferences: [],
        registry,
        now: missedDayInstant,
      });
      const inserted1 = filterNewReminderCandidates(run1, existingDedupeKeys);
      expect(inserted1).toHaveLength(1);
      expect(inserted1[0]?.dedupeKey).toBe(
        `POINTS_EXPIRY:${BALANCE_ID}:2026-12-31:30`,
      );
      inserted1.forEach((c) => existingDedupeKeys.add(c.dedupeKey));

      // Second run on the same day -> 0 new reminders
      const run2 = await generateRemindersForUser({
        user: { id: USER_ID, timeZone: "America/Los_Angeles" },
        savedPreferences: [],
        registry,
        now: missedDayInstant,
      });
      const inserted2 = filterNewReminderCandidates(run2, existingDedupeKeys);
      expect(inserted2).toHaveLength(0);

      // On the expiry date itself (2026-12-31), no reminder is generated
      expect(
        generatePointsExpiryRemindersForBalances({
          userId: USER_ID,
          localDate: "2026-12-31",
          balances: [balance],
        }),
      ).toHaveLength(0);
    });

    it("changing the expiry date generates reminders for the new expiry date", () => {
      const existingDedupeKeys = new Set<string>([
        `POINTS_EXPIRY:${BALANCE_ID}:2026-12-31:30`,
      ]);

      const updatedBalance = makeBalance({ expiryDate: "2027-01-15" });
      // 30 days before 2027-01-15 is 2026-12-16
      const candidates = generatePointsExpiryRemindersForBalances({
        userId: USER_ID,
        localDate: "2026-12-16",
        balances: [updatedBalance],
      });
      const fresh = filterNewReminderCandidates(candidates, existingDedupeKeys);
      expect(fresh).toHaveLength(1);
      expect(fresh[0]?.dedupeKey).toBe(
        `POINTS_EXPIRY:${BALANCE_ID}:2027-01-15:30`,
      );
      expect(fresh[0]?.dueDate).toBe("2027-01-15");
    });

    it("balance of 0 gets no reminders, and POINTS_EXPIRY turned off gets no reminders", async () => {
      const zeroBalance = makeBalance({
        pointsBalance: 0,
        expiryDate: "2026-12-31",
      });
      expect(
        generatePointsExpiryRemindersForBalances({
          userId: USER_ID,
          localDate: "2026-12-01",
          balances: [zeroBalance],
        }),
      ).toHaveLength(0);

      const positiveBalance = makeBalance({
        pointsBalance: 15000,
        expiryDate: "2026-12-31",
      });
      const registry = createReminderGeneratorRegistry();
      registry.register(
        "POINTS_EXPIRY",
        createPointsExpiryReminderGenerator(async () => [positiveBalance]),
      );

      const disabledRun = await generateRemindersForUser({
        user: { id: USER_ID, timeZone: "America/Los_Angeles" },
        savedPreferences: [{ type: "POINTS_EXPIRY", enabled: false }],
        registry,
        now: new Date("2026-12-01T18:00:00.000Z"),
      });
      expect(disabledRun).toHaveLength(0);
    });
  });
});
