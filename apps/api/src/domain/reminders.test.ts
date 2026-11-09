import { describe, it, expect } from "vitest";
import {
  createReminderGeneratorRegistry,
  createTestReminderGenerator,
  filterNewReminderCandidates,
  generateRemindersForUser,
  isReminderTypeEnabled,
  resolveUserPreferences,
} from "./reminders.js";

describe("Reminder domain & job runner (US-05..09 / Issue #19)", () => {
  const fixedNow = new Date("2026-11-10T03:30:00.000Z"); // 2026-11-09 in America/Los_Angeles

  it("AC3: user with no saved preference for a type counts as enabled by default", () => {
    expect(isReminderTypeEnabled([], "PAYMENT_DUE")).toBe(true);
    expect(isReminderTypeEnabled([], "PERK_ENDING")).toBe(true);
    expect(isReminderTypeEnabled([], "ROTATING_CATEGORY")).toBe(true);
    expect(isReminderTypeEnabled([], "POINTS_EXPIRY")).toBe(true);

    const resolved = resolveUserPreferences([
      { type: "PERK_ENDING", enabled: false },
    ]);
    expect(resolved).toEqual([
      { type: "PAYMENT_DUE", enabled: true },
      { type: "PERK_ENDING", enabled: false },
      { type: "ROTATING_CATEGORY", enabled: true },
      { type: "POINTS_EXPIRY", enabled: true },
    ]);
  });

  it("AC1 & AC3: runs registered generators using user's time zone and skips disabled reminder types", async () => {
    const registry = createReminderGeneratorRegistry();
    registry.register(
      "PAYMENT_DUE",
      createTestReminderGenerator({
        type: "PAYMENT_DUE",
        title: "Payment due in 5 days",
        body: "Mint Everyday payment is due soon.",
      }),
    );
    registry.register(
      "PERK_ENDING",
      createTestReminderGenerator({
        type: "PERK_ENDING",
        title: "Ride credit ends soon",
        body: "$15.00 ride credit resets at the end of the month.",
      }),
    );

    const candidates = await generateRemindersForUser({
      user: { id: "user-1", timeZone: "America/Los_Angeles" },
      savedPreferences: [{ type: "PERK_ENDING", enabled: false }],
      registry,
      now: fixedNow,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual({
      userId: "user-1",
      type: "PAYMENT_DUE",
      title: "Payment due in 5 days",
      body: "Mint Everyday payment is due soon.",
      dueDate: "2026-11-09",
      dedupeKey: "PAYMENT_DUE:user-1:2026-11-09",
    });
  });

  it("AC1: running twice with the same dedupeKey produces no duplicate notifications", async () => {
    const registry = createReminderGeneratorRegistry();
    registry.register(
      "PAYMENT_DUE",
      createTestReminderGenerator({
        type: "PAYMENT_DUE",
        title: "Payment due in 5 days",
        body: "Mint Everyday payment is due soon.",
      }),
    );

    const firstRunCandidates = await generateRemindersForUser({
      user: { id: "user-1", timeZone: "America/Los_Angeles" },
      savedPreferences: [],
      registry,
      now: fixedNow,
    });

    const existingDedupeKeys = new Set<string>();
    const firstInserted = filterNewReminderCandidates(
      firstRunCandidates,
      existingDedupeKeys,
    );
    expect(firstInserted).toHaveLength(1);
    for (const item of firstInserted) {
      existingDedupeKeys.add(item.dedupeKey);
    }

    // Second run on the same day with same clock
    const secondRunCandidates = await generateRemindersForUser({
      user: { id: "user-1", timeZone: "America/Los_Angeles" },
      savedPreferences: [],
      registry,
      now: fixedNow,
    });
    const secondInserted = filterNewReminderCandidates(
      secondRunCandidates,
      existingDedupeKeys,
    );
    expect(secondInserted).toHaveLength(0);
  });

  it("supports unregistering and inspecting generators in the registry", () => {
    const registry = createReminderGeneratorRegistry();
    const gen = createTestReminderGenerator({ type: "POINTS_EXPIRY" });
    registry.register("POINTS_EXPIRY", gen);

    expect(registry.get("POINTS_EXPIRY")).toBe(gen);
    expect(registry.getAll().size).toBe(1);

    registry.unregister("POINTS_EXPIRY");
    expect(registry.get("POINTS_EXPIRY")).toBeUndefined();
    expect(registry.getAll().size).toBe(0);
  });
});
