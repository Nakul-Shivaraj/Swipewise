import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "./db.js";
import { DEMO_CARDS, DEMO_PROGRAMS } from "./seed-data.js";
import { seedDemoWalletForUser } from "./demo-wallet.js";

describe("seedDemoWalletForUser (dev-only helper for Issue #12)", () => {
  beforeEach(async () => {
    await prisma.walletCard.deleteMany();
    await prisma.rewardRule.deleteMany();
    await prisma.card.deleteMany();
    await prisma.rewardsProgram.deleteMany();
    await prisma.user.deleteMany();

    for (const prog of DEMO_PROGRAMS) {
      await prisma.rewardsProgram.create({
        data: {
          name: prog.name,
          centsPer100Points: prog.centsPer100Points,
        },
      });
    }

    for (const card of DEMO_CARDS) {
      const program = await prisma.rewardsProgram.findUniqueOrThrow({
        where: { name: card.programName },
      });
      await prisma.card.create({
        data: {
          name: card.name,
          issuer: card.issuer,
          artColor: card.artColor,
          isDemo: card.isDemo,
          programId: program.id,
          annualFeeCents: card.annualFeeCents,
          baseRateX100: card.baseRateX100,
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.walletCard.deleteMany();
    await prisma.rewardRule.deleteMany();
    await prisma.card.deleteMany();
    await prisma.rewardsProgram.deleteMany();
    await prisma.user.deleteMany();
  });

  it("refuses to run unless ALLOW_DEMO_SEED=true is set", async () => {
    await expect(
      seedDemoWalletForUser({
        email: "priya@example.com",
        env: { ALLOW_DEMO_SEED: "false" },
        prisma,
      }),
    ).rejects.toThrow(/ALLOW_DEMO_SEED=true/);

    await expect(
      seedDemoWalletForUser({
        email: "priya@example.com",
        env: {},
        prisma,
      }),
    ).rejects.toThrow(/ALLOW_DEMO_SEED=true/);
  });

  it("adds the 3 demo cards to an existing user wallet and is idempotent on repeat runs", async () => {
    await prisma.user.create({
      data: {
        name: "Priya Sharma",
        email: "priya@example.com",
        passwordHash: "hash",
      },
    });

    const firstRun = await seedDemoWalletForUser({
      email: "PRIYA@example.com",
      env: { ALLOW_DEMO_SEED: "true" },
      prisma,
    });
    expect(firstRun.addedCount).toBe(3);
    expect(firstRun.totalWalletCards).toBe(3);

    const secondRun = await seedDemoWalletForUser({
      email: "priya@example.com",
      env: { ALLOW_DEMO_SEED: "true" },
      prisma,
    });
    expect(secondRun.addedCount).toBe(0);
    expect(secondRun.totalWalletCards).toBe(3);
  });
});
