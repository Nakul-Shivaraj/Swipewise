import { describe, it, expect } from "vitest";
import {
  resolveDueDateForCycle,
  generatePaymentDueRemindersForCards,
  createPaymentDueReminderGenerator,
  PaymentReminderCardInput,
} from "./payment-reminders.js";
import {
  createReminderGeneratorRegistry,
  filterNewReminderCandidates,
  generateRemindersForUser,
} from "./reminders.js";

describe("Payment due reminders domain (US-08 / Issue #20)", () => {
  const USER_ID = "11111111-1111-4111-8111-111111111111";
  const CARD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  function makeCard(
    overrides: Partial<PaymentReminderCardInput> = {},
  ): PaymentReminderCardInput {
    return {
      walletCardId: CARD_ID,
      userId: USER_ID,
      cardDisplayName: "Mint Everyday",
      dueDay: 15,
      isAutopay: false,
      paidCycles: [],
      ...overrides,
    };
  }

  describe("AC2: Due days past the end of a short month fall on its last day", () => {
    it("clamps due day 31 in April to April 30", () => {
      expect(resolveDueDateForCycle("2026-04", 31)).toBe("2026-04-30");
    });

    it("clamps due day 30 in February to Feb 28 in non-leap year and Feb 29 in leap year 2028", () => {
      expect(resolveDueDateForCycle("2026-02", 30)).toBe("2026-02-28");
      expect(resolveDueDateForCycle("2028-02", 30)).toBe("2028-02-29");
    });
  });

  describe("AC3: Autopay off vs Autopay on reminder offsets", () => {
    it("autopay off sends reminders 5 days before and 1 day before, not 3 days before", () => {
      const card = makeCard({ dueDay: 15, isAutopay: false });

      // 5 days before (2026-11-10) -> sends :5 reminder
      const fiveDaysBefore = generatePaymentDueRemindersForCards({
        userId: USER_ID,
        localDate: "2026-11-10",
        cards: [card],
      });
      expect(fiveDaysBefore).toHaveLength(1);
      expect(fiveDaysBefore[0]).toMatchObject({
        userId: USER_ID,
        type: "PAYMENT_DUE",
        dueDate: "2026-11-15",
        dedupeKey: `PAYMENT_DUE:${CARD_ID}:2026-11:5`,
      });

      // 1 day before (2026-11-14) -> sends :1 reminder
      const oneDayBefore = generatePaymentDueRemindersForCards({
        userId: USER_ID,
        localDate: "2026-11-14",
        cards: [card],
      });
      expect(oneDayBefore).toHaveLength(1);
      expect(oneDayBefore[0]).toMatchObject({
        userId: USER_ID,
        type: "PAYMENT_DUE",
        dueDate: "2026-11-15",
        dedupeKey: `PAYMENT_DUE:${CARD_ID}:2026-11:1`,
      });

      // 6 days before (2026-11-09) -> nothing
      expect(
        generatePaymentDueRemindersForCards({
          userId: USER_ID,
          localDate: "2026-11-09",
          cards: [card],
        }),
      ).toHaveLength(0);
    });

    it("autopay on sends only one reminder 3 days before", () => {
      const card = makeCard({ dueDay: 15, isAutopay: true });

      // 5 days before (2026-11-10) -> nothing when autopay is on
      expect(
        generatePaymentDueRemindersForCards({
          userId: USER_ID,
          localDate: "2026-11-10",
          cards: [card],
        }),
      ).toHaveLength(0);

      // 3 days before (2026-11-12) -> sends :3 reminder
      const threeDaysBefore = generatePaymentDueRemindersForCards({
        userId: USER_ID,
        localDate: "2026-11-12",
        cards: [card],
      });
      expect(threeDaysBefore).toHaveLength(1);
      expect(threeDaysBefore[0]).toMatchObject({
        userId: USER_ID,
        type: "PAYMENT_DUE",
        dueDate: "2026-11-15",
        dedupeKey: `PAYMENT_DUE:${CARD_ID}:2026-11:3`,
      });
    });
  });

  describe("Catch-up, deduplication, and cross-month/year cycle boundaries", () => {
    it("catches up when the job missed a day (on or after reminder date and before due date)", () => {
      const card = makeCard({ dueDay: 15, isAutopay: false });

      // Job missed 2026-11-10 (5 days before) and runs on 2026-11-12 (3 days before)
      const caughtUp = generatePaymentDueRemindersForCards({
        userId: USER_ID,
        localDate: "2026-11-12",
        cards: [card],
      });
      expect(caughtUp).toHaveLength(1);
      expect(caughtUp[0]?.dedupeKey).toBe(`PAYMENT_DUE:${CARD_ID}:2026-11:5`);

      // On the due date itself (2026-11-15), no reminder is created (must be before due date)
      expect(
        generatePaymentDueRemindersForCards({
          userId: USER_ID,
          localDate: "2026-11-15",
          cards: [card],
        }),
      ).toHaveLength(0);
    });

    it("running the job twice produces no duplicate notifications", async () => {
      const card = makeCard({ dueDay: 15, isAutopay: false });
      const registry = createReminderGeneratorRegistry();
      registry.register(
        "PAYMENT_DUE",
        createPaymentDueReminderGenerator(async () => [card]),
      );

      const fixedNow = new Date("2026-11-10T18:00:00.000Z"); // 2026-11-10 in America/Los_Angeles
      const existingDedupeKeys = new Set<string>();

      const run1 = await generateRemindersForUser({
        user: { id: USER_ID, timeZone: "America/Los_Angeles" },
        savedPreferences: [],
        registry,
        now: fixedNow,
      });
      const inserted1 = filterNewReminderCandidates(run1, existingDedupeKeys);
      expect(inserted1).toHaveLength(1);
      inserted1.forEach((c) => existingDedupeKeys.add(c.dedupeKey));

      const run2 = await generateRemindersForUser({
        user: { id: USER_ID, timeZone: "America/Los_Angeles" },
        savedPreferences: [],
        registry,
        now: fixedNow,
      });
      const inserted2 = filterNewReminderCandidates(run2, existingDedupeKeys);
      expect(inserted2).toHaveLength(0);
    });

    it("assigns cycle YYYY-MM from the month of the due date, including previous month and December → January boundary", () => {
      const card = makeCard({ dueDay: 3, isAutopay: false });

      // Due day 3 in November (2026-11-03): 5 days before is 2026-10-29 -> cycle is 2026-11
      const octToNov = generatePaymentDueRemindersForCards({
        userId: USER_ID,
        localDate: "2026-10-29",
        cards: [card],
      });
      expect(octToNov).toHaveLength(1);
      expect(octToNov[0]).toMatchObject({
        dueDate: "2026-11-03",
        dedupeKey: `PAYMENT_DUE:${CARD_ID}:2026-11:5`,
      });

      // December -> January boundary: Due day 3 in January (2027-01-03): 5 days before is 2026-12-29 -> cycle is 2027-01
      const decToJan = generatePaymentDueRemindersForCards({
        userId: USER_ID,
        localDate: "2026-12-29",
        cards: [card],
      });
      expect(decToJan).toHaveLength(1);
      expect(decToJan[0]).toMatchObject({
        dueDate: "2027-01-03",
        dedupeKey: `PAYMENT_DUE:${CARD_ID}:2027-01:5`,
      });
    });

    it("AC4: cycle marked paid stops reminders for that cycle, while next month still reminds", () => {
      const card = makeCard({
        dueDay: 15,
        isAutopay: false,
        paidCycles: ["2026-11"],
      });

      // November cycle is paid -> no 5-day or 1-day reminders in November
      expect(
        generatePaymentDueRemindersForCards({
          userId: USER_ID,
          localDate: "2026-11-10",
          cards: [card],
        }),
      ).toHaveLength(0);
      expect(
        generatePaymentDueRemindersForCards({
          userId: USER_ID,
          localDate: "2026-11-14",
          cards: [card],
        }),
      ).toHaveLength(0);

      // Next month (December 2026-12) is not paid -> reminds on 2026-12-10
      const decReminders = generatePaymentDueRemindersForCards({
        userId: USER_ID,
        localDate: "2026-12-10",
        cards: [card],
      });
      expect(decReminders).toHaveLength(1);
      expect(decReminders[0]).toMatchObject({
        dueDate: "2026-12-15",
        dedupeKey: `PAYMENT_DUE:${CARD_ID}:2026-12:5`,
      });
    });
  });
});
