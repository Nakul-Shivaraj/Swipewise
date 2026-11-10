import { describe, it, expect } from "vitest";
import {
  buildRotatingCategoryDedupeKey,
  createRotatingCategoryReminderGenerator,
  generateRotatingCategoryRemindersForCards,
  RotatingReminderCardInput,
} from "./rotating-categories.js";
import {
  createReminderGeneratorRegistry,
  filterNewReminderCandidates,
  generateRemindersForUser,
} from "./reminders.js";

describe("Rotating category reminders domain (US-05 / Issue #23)", () => {
  const USER_ID = "11111111-1111-4111-8111-111111111111";
  const WALLET_CARD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  function makeCard(
    overrides: Partial<RotatingReminderCardInput> = {},
  ): RotatingReminderCardInput {
    return {
      walletCardId: WALLET_CARD_ID,
      userId: USER_ID,
      cardDisplayName: "Orbit Quarterly",
      rotatingQuarters: ["2026-Q2", "2026-Q4", "2027-Q1"],
      activatedQuarters: [],
      ...overrides,
    };
  }

  it("AC4: generates a reminder 7 days before the next quarter starts with dedupeKey ROTATING_CATEGORY:<walletCardId>:<nextQuarter>", () => {
    const card = makeCard();

    // 7 days before 2027-Q1 (2027-01-01) is 2026-12-25
    const remindersDec25 = generateRotatingCategoryRemindersForCards({
      userId: USER_ID,
      localDate: "2026-12-25",
      cards: [card],
    });
    expect(remindersDec25).toHaveLength(1);
    expect(remindersDec25[0]).toMatchObject({
      userId: USER_ID,
      type: "ROTATING_CATEGORY",
      dueDate: "2027-01-01",
      dedupeKey: buildRotatingCategoryDedupeKey(WALLET_CARD_ID, "2027-Q1"),
    });
    expect(remindersDec25[0]?.dedupeKey).toBe(
      `ROTATING_CATEGORY:${WALLET_CARD_ID}:2027-Q1`,
    );

    // 8 days before 2027-Q1 (2026-12-24) -> no reminder yet
    expect(
      generateRotatingCategoryRemindersForCards({
        userId: USER_ID,
        localDate: "2026-12-24",
        cards: [card],
      }),
    ).toHaveLength(0);

    // Catch-up: 3 days before 2027-Q1 (2026-12-29) -> still reminds if missed
    const catchUpDec29 = generateRotatingCategoryRemindersForCards({
      userId: USER_ID,
      localDate: "2026-12-29",
      cards: [card],
    });
    expect(catchUpDec29).toHaveLength(1);
    expect(catchUpDec29[0]?.dedupeKey).toBe(
      `ROTATING_CATEGORY:${WALLET_CARD_ID}:2027-Q1`,
    );

    // On 2027-01-01 (quarter has started), next quarter is 2027-Q2, so no 2027-Q1 reminder
    expect(
      generateRotatingCategoryRemindersForCards({
        userId: USER_ID,
        localDate: "2027-01-01",
        cards: [card],
      }),
    ).toHaveLength(0);

    // 7 days before 2026-Q2 (2026-04-01) is 2026-03-25
    const remindersMar25 = generateRotatingCategoryRemindersForCards({
      userId: USER_ID,
      localDate: "2026-03-25",
      cards: [card],
    });
    expect(remindersMar25).toHaveLength(1);
    expect(remindersMar25[0]?.dedupeKey).toBe(
      `ROTATING_CATEGORY:${WALLET_CARD_ID}:2026-Q2`,
    );
  });

  it("running the job twice produces no duplicate notifications", async () => {
    const card = makeCard();
    const registry = createReminderGeneratorRegistry();
    registry.register(
      "ROTATING_CATEGORY",
      createRotatingCategoryReminderGenerator(async () => [card]),
    );

    // 2026-12-25 in America/Los_Angeles
    const fixedNow = new Date("2026-12-25T18:00:00.000Z");
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

  it("skips reminder if the next quarter is already activated", () => {
    const activatedCard = makeCard({
      activatedQuarters: ["2027-Q1"],
    });

    const reminders = generateRotatingCategoryRemindersForCards({
      userId: USER_ID,
      localDate: "2026-12-25",
      cards: [activatedCard],
    });
    expect(reminders).toHaveLength(0);
  });

  it("skips reminder if ROTATING_CATEGORY notification preference is turned off", async () => {
    const card = makeCard();
    const registry = createReminderGeneratorRegistry();
    registry.register(
      "ROTATING_CATEGORY",
      createRotatingCategoryReminderGenerator(async () => [card]),
    );

    const fixedNow = new Date("2026-12-25T18:00:00.000Z");
    const generated = await generateRemindersForUser({
      user: { id: USER_ID, timeZone: "America/Los_Angeles" },
      savedPreferences: [{ type: "ROTATING_CATEGORY", enabled: false }],
      registry,
      now: fixedNow,
    });

    expect(generated).toHaveLength(0);
  });
});
