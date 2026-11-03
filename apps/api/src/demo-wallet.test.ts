import { describe, it, expect, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { DEMO_CARDS } from "./seed-data.js";
import { seedDemoWalletForUser } from "./demo-wallet.js";

function createFakePrisma() {
  const users: Array<{ id: string; email: string; name: string }> = [
    { id: "user-1", email: "priya@example.com", name: "Priya Sharma" },
  ];
  const cards = DEMO_CARDS.map((c, idx) => ({
    id: `card-${idx + 1}`,
    name: c.name,
  }));
  const walletCards: Array<{ id: string; userId: string; cardId: string }> = [];

  const fake = {
    user: {
      findUnique: async ({ where }: { where: { email: string } }) =>
        users.find((u) => u.email === where.email) ?? null,
    },
    card: {
      findMany: async ({ where }: { where: { name: { in: string[] } } }) =>
        cards.filter((c) => where.name.in.includes(c.name)),
    },
    walletCard: {
      findMany: async ({ where }: { where: { userId: string } }) =>
        walletCards.filter((wc) => wc.userId === where.userId),
      create: async ({
        data,
      }: {
        data: { userId: string; cardId: string };
      }) => {
        const created = {
          id: `wc-${walletCards.length + 1}`,
          userId: data.userId,
          cardId: data.cardId,
        };
        walletCards.push(created);
        return created;
      },
      count: async ({ where }: { where: { userId: string } }) =>
        walletCards.filter((wc) => wc.userId === where.userId).length,
    },
  };

  return fake as unknown as PrismaClient;
}

describe("seedDemoWalletForUser (dev-only helper for Issue #12)", () => {
  let fakePrisma: PrismaClient;

  beforeEach(() => {
    fakePrisma = createFakePrisma();
  });

  it("refuses to run unless ALLOW_DEMO_SEED=true is set", async () => {
    await expect(
      seedDemoWalletForUser({
        email: "priya@example.com",
        env: { ALLOW_DEMO_SEED: "false" },
        prisma: fakePrisma,
      }),
    ).rejects.toThrow(/ALLOW_DEMO_SEED=true/);

    await expect(
      seedDemoWalletForUser({
        email: "priya@example.com",
        env: {},
        prisma: fakePrisma,
      }),
    ).rejects.toThrow(/ALLOW_DEMO_SEED=true/);
  });

  it("throws if the user email does not exist", async () => {
    await expect(
      seedDemoWalletForUser({
        email: "unknown@example.com",
        env: { ALLOW_DEMO_SEED: "true" },
        prisma: fakePrisma,
      }),
    ).rejects.toThrow(/No user found/);
  });

  it("adds the 3 demo cards to an existing user wallet and is idempotent on repeat runs", async () => {
    const firstRun = await seedDemoWalletForUser({
      email: "PRIYA@example.com",
      env: { ALLOW_DEMO_SEED: "true" },
      prisma: fakePrisma,
    });
    expect(firstRun.addedCount).toBe(3);
    expect(firstRun.totalWalletCards).toBe(3);

    const secondRun = await seedDemoWalletForUser({
      email: "priya@example.com",
      env: { ALLOW_DEMO_SEED: "true" },
      prisma: fakePrisma,
    });
    expect(secondRun.addedCount).toBe(0);
    expect(secondRun.totalWalletCards).toBe(3);
  });
});
