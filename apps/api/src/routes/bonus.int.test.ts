import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../db.js";
import { getCsrfTokenAndCookie } from "./test-helpers.js";

describe("Bonus Tracker Integration Tests (US-07 / Issue #22)", () => {
  let currentNow = new Date("2026-02-15T12:00:00.000Z");

  const app = createApp({
    prisma,
    schema: "test",
    rateLimitMax: 100,
    generalRateLimitMax: 100,
    nowProvider: () => currentNow,
  });

  let harborCardId = "";

  beforeEach(async () => {
    currentNow = new Date("2026-02-15T12:00:00.000Z");
    await prisma.spendEntry.deleteMany();
    await prisma.walletCardBonusOffer.deleteMany();
    await prisma.bonusOffer.deleteMany();
    await prisma.walletCardPaidCycle.deleteMany();
    await prisma.walletCardPaymentSetting.deleteMany();
    await prisma.walletCard.deleteMany();
    await prisma.card.deleteMany();
    await prisma.rewardsProgram.deleteMany();
    await prisma.user.deleteMany();
    await prisma.rateLimit.deleteMany();

    const program = await prisma.rewardsProgram.create({
      data: {
        name: "Harbor Points",
        centsPer100Points: 125,
      },
    });

    const card = await prisma.card.create({
      data: {
        name: "Harbor Travel Plus",
        issuer: "Demo Bank",
        artColor: "#2F74D0",
        isDemo: true,
        programId: program.id,
        annualFeeCents: 9500,
        baseRateX100: 100,
        bonusOffer: {
          create: {
            spendRequirementCents: 300000, // $3,000 spend
            windowMonths: 3, // 3 months
            bonusPoints: 60000, // 60k points
          },
        },
      },
      include: {
        bonusOffer: true,
      },
    });

    harborCardId = card.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("AC1..AC4: handles offer copying, logging/editing/deleting spend entries, refunds, deadlines, and ownership checks", async () => {
    // 1. Create User A
    const csrfA = await getCsrfTokenAndCookie(app);
    const signupA = await request(app)
      .post("/api/v1/auth/signup")
      .set("x-csrf-token", csrfA.token)
      .set("Cookie", csrfA.cookie)
      .send({
        name: "User A",
        email: "user-a-bonus@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      });
    expect(signupA.status).toBe(201);
    const cookieUserA = signupA.headers["set-cookie"]![0]!;

    // 2. Add card with opened date
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const addCardRes = await request(app)
      .post("/api/v1/wallet/cards")
      .set("Cookie", `${cookieUserA}; ${csrfCookie}`)
      .set("x-csrf-token", csrfToken)
      .send({
        cardId: harborCardId,
        nickname: "My Harbor Card",
        openedDate: "2026-01-01",
      });
    expect(addCardRes.status).toBe(201);
    const walletCardId = addCardRes.body.walletCard.id;

    // 3. Verify bonus offer is copied and returned
    const listBonusRes = await request(app)
      .get("/api/v1/bonus-offers")
      .set("Cookie", cookieUserA);
    expect(listBonusRes.status).toBe(200);
    expect(listBonusRes.body.bonuses).toHaveLength(1);
    const bonus = listBonusRes.body.bonuses[0]!;
    expect(bonus.cardName).toBe("Harbor Travel Plus");
    expect(bonus.requiredSpendCents).toBe(300000);
    expect(bonus.deadline).toBe("2026-04-01");
    expect(bonus.spentCents).toBe(0);
    expect(bonus.remainingCents).toBe(300000);
    expect(bonus.status).toBe("In progress");

    // 4. Log a spending entry of $1,000 (100,000 cents)
    const { token: csrfToken2, cookie: csrfCookie2 } =
      await getCsrfTokenAndCookie(app);
    const addSpendRes = await request(app)
      .post(`/api/v1/wallet/cards/${walletCardId}/spend-entries`)
      .set("Cookie", `${cookieUserA}; ${csrfCookie2}`)
      .set("x-csrf-token", csrfToken2)
      .send({
        amountCents: 100000,
        date: "2026-01-15",
        note: "Flight tickets",
      });
    expect(addSpendRes.status).toBe(201);
    const spendEntryId = addSpendRes.body.spendEntry.id;

    // Verify progress updated
    const checkRes1 = await request(app)
      .get("/api/v1/bonus-offers")
      .set("Cookie", cookieUserA);
    expect(checkRes1.body.bonuses[0]!.spentCents).toBe(100000);
    expect(checkRes1.body.bonuses[0]!.remainingCents).toBe(200000);

    // 5. Add a refund (-$200 / -20,000 cents)
    const { token: csrfToken3, cookie: csrfCookie3 } =
      await getCsrfTokenAndCookie(app);
    const addRefundRes = await request(app)
      .post(`/api/v1/wallet/cards/${walletCardId}/spend-entries`)
      .set("Cookie", `${cookieUserA}; ${csrfCookie3}`)
      .set("x-csrf-token", csrfToken3)
      .send({
        amountCents: -20000,
        date: "2026-01-20",
        note: "Partial ticket refund",
      });
    expect(addRefundRes.status).toBe(201);

    const checkRes2 = await request(app)
      .get("/api/v1/bonus-offers")
      .set("Cookie", cookieUserA);
    expect(checkRes2.body.bonuses[0]!.spentCents).toBe(80000);
    expect(checkRes2.body.bonuses[0]!.remainingCents).toBe(220000);

    // 6. Edit spending entry
    const { token: csrfToken4, cookie: csrfCookie4 } =
      await getCsrfTokenAndCookie(app);
    const editSpendRes = await request(app)
      .patch(`/api/v1/spend-entries/${spendEntryId}`)
      .set("Cookie", `${cookieUserA}; ${csrfCookie4}`)
      .set("x-csrf-token", csrfToken4)
      .send({
        amountCents: 200000, // update from $1000 to $2000
      });
    expect(editSpendRes.status).toBe(200);

    const checkRes3 = await request(app)
      .get("/api/v1/bonus-offers")
      .set("Cookie", cookieUserA);
    // $2000 - $200 refund = $1800 (180,000 cents)
    expect(checkRes3.body.bonuses[0]!.spentCents).toBe(180000);

    // 7. Add spending after deadline (should not count)
    const { token: csrfToken5, cookie: csrfCookie5 } =
      await getCsrfTokenAndCookie(app);
    await request(app)
      .post(`/api/v1/wallet/cards/${walletCardId}/spend-entries`)
      .set("Cookie", `${cookieUserA}; ${csrfCookie5}`)
      .set("x-csrf-token", csrfToken5)
      .send({
        amountCents: 150000,
        date: "2026-04-10", // deadline was 2026-04-01!
        note: "After deadline purchase",
      });

    const checkRes4 = await request(app)
      .get("/api/v1/bonus-offers")
      .set("Cookie", cookieUserA);
    expect(checkRes4.body.bonuses[0]!.spentCents).toBe(180000);

    // 8. Delete refund entry
    const { token: csrfToken6, cookie: csrfCookie6 } =
      await getCsrfTokenAndCookie(app);
    const deleteRes = await request(app)
      .delete(`/api/v1/spend-entries/${addRefundRes.body.spendEntry.id}`)
      .set("Cookie", `${cookieUserA}; ${csrfCookie6}`)
      .set("x-csrf-token", csrfToken6);
    expect(deleteRes.status).toBe(200);

    const checkRes5 = await request(app)
      .get("/api/v1/bonus-offers")
      .set("Cookie", cookieUserA);
    // Refund removed, now $2000 (200,000 cents)
    expect(checkRes5.body.bonuses[0]!.spentCents).toBe(200000);

    // 9. Reaching requirement marks status as Earned
    const { token: csrfToken7, cookie: csrfCookie7 } =
      await getCsrfTokenAndCookie(app);
    await request(app)
      .post(`/api/v1/wallet/cards/${walletCardId}/spend-entries`)
      .set("Cookie", `${cookieUserA}; ${csrfCookie7}`)
      .set("x-csrf-token", csrfToken7)
      .send({
        amountCents: 100000,
        date: "2026-02-01",
      });

    const checkRes6 = await request(app)
      .get("/api/v1/bonus-offers")
      .set("Cookie", cookieUserA);
    expect(checkRes6.body.bonuses[0]!.spentCents).toBe(300000);
    expect(checkRes6.body.bonuses[0]!.status).toBe("Earned");

    // 10. Card without open date indicates user should add one
    const { token: csrfToken8, cookie: csrfCookie8 } =
      await getCsrfTokenAndCookie(app);
    const addCardNoDateRes = await request(app)
      .post("/api/v1/wallet/cards")
      .set("Cookie", `${cookieUserA}; ${csrfCookie8}`)
      .set("x-csrf-token", csrfToken8)
      .send({
        cardId: harborCardId,
        nickname: "No Date Card",
      });
    expect(addCardNoDateRes.status).toBe(201);

    const checkRes7 = await request(app)
      .get(
        `/api/v1/wallet/cards/${addCardNoDateRes.body.walletCard.id}/bonus-offer`,
      )
      .set("Cookie", cookieUserA);
    expect(checkRes7.status).toBe(200);
    expect(checkRes7.body.bonus.requiresOpenDate).toBe(true);
    expect(checkRes7.body.bonus.deadline).toBeNull();

    // 11. Security & Ownership: User B cannot access or modify User A's data (404)
    const csrfB = await getCsrfTokenAndCookie(app);
    const signupB = await request(app)
      .post("/api/v1/auth/signup")
      .set("x-csrf-token", csrfB.token)
      .set("Cookie", csrfB.cookie)
      .send({
        name: "User B",
        email: "user-b-bonus@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      });
    expect(signupB.status).toBe(201);
    const cookieUserB = signupB.headers["set-cookie"]![0]!;

    // User B tries to view User A's bonus offer
    const userBAccessRes = await request(app)
      .get(`/api/v1/wallet/cards/${walletCardId}/bonus-offer`)
      .set("Cookie", cookieUserB);
    expect(userBAccessRes.status).toBe(404);

    // User B tries to add spend entry to User A's card
    const { token: csrfTokenB, cookie: csrfCookieB } =
      await getCsrfTokenAndCookie(app);
    const userBAddSpendRes = await request(app)
      .post(`/api/v1/wallet/cards/${walletCardId}/spend-entries`)
      .set("Cookie", `${cookieUserB}; ${csrfCookieB}`)
      .set("x-csrf-token", csrfTokenB)
      .send({
        amountCents: 5000,
        date: "2026-02-01",
      });
    expect(userBAddSpendRes.status).toBe(404);

    // User B tries to edit User A's spend entry
    const userBEditSpendRes = await request(app)
      .patch(`/api/v1/spend-entries/${spendEntryId}`)
      .set("Cookie", `${cookieUserB}; ${csrfCookieB}`)
      .set("x-csrf-token", csrfTokenB)
      .send({
        amountCents: 99999,
      });
    expect(userBEditSpendRes.status).toBe(404);

    // User B tries to delete User A's spend entry
    const userBDeleteSpendRes = await request(app)
      .delete(`/api/v1/spend-entries/${spendEntryId}`)
      .set("Cookie", `${cookieUserB}; ${csrfCookieB}`)
      .set("x-csrf-token", csrfTokenB);
    expect(userBDeleteSpendRes.status).toBe(404);

    // 12. Security: Card-number guard in note field
    const invalidNoteRes = await request(app)
      .post(`/api/v1/wallet/cards/${walletCardId}/spend-entries`)
      .set("Cookie", `${cookieUserA}; ${csrfCookieB}`)
      .set("x-csrf-token", csrfTokenB)
      .send({
        amountCents: 5000,
        date: "2026-02-01",
        note: "Card is 4111 1111 1111 1111",
      });
    expect(invalidNoteRes.status).toBe(400);
    expect(invalidNoteRes.body.error.message).toBe(
      "Don't enter card numbers. SwipeWise only needs the card name.",
    );
  });

  it("backfills bonus offers for existing wallet cards added before the feature in an idempotent way", async () => {
    const csrfReg = await getCsrfTokenAndCookie(app);
    const signupRes = await request(app)
      .post("/api/v1/auth/signup")
      .set("Cookie", csrfReg.cookie)
      .set("x-csrf-token", csrfReg.token)
      .send({
        name: "Backfill User",
        email: "backfill-test@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      });
    expect(signupRes.status).toBe(201);
    const userCookie = signupRes.headers["set-cookie"]![0]!;

    const csrfAdd = await getCsrfTokenAndCookie(app);
    const addCardRes = await request(app)
      .post("/api/v1/wallet/cards")
      .set("Cookie", `${userCookie}; ${csrfAdd.cookie}`)
      .set("x-csrf-token", csrfAdd.token)
      .send({
        cardId: harborCardId,
        openedDate: "2026-01-01",
      });
    expect(addCardRes.status).toBe(201);
    const walletCardId = addCardRes.body.walletCard.id;

    // Simulate an existing wallet card added BEFORE the bonus offer feature:
    // Delete the WalletCardBonusOffer copy
    await prisma.walletCardBonusOffer.deleteMany({
      where: { walletCardId },
    });

    const beforeCheck = await prisma.walletCardBonusOffer.findUnique({
      where: { walletCardId },
    });
    expect(beforeCheck).toBeNull();

    // Verify GET /api/v1/bonus-offers creates and returns the bonus offer copy
    const bonusRes = await request(app)
      .get("/api/v1/bonus-offers")
      .set("Cookie", userCookie);
    expect(bonusRes.status).toBe(200);
    expect(bonusRes.body.bonuses).toHaveLength(1);
    expect(bonusRes.body.bonuses[0].cardName).toBe("Harbor Travel Plus");
    expect(bonusRes.body.bonuses[0].requiredSpendCents).toBe(300000);
    expect(bonusRes.body.bonuses[0].bonusPoints).toBe(60000);

    // Verify copy was persisted matching catalog card offer
    const afterCheck = await prisma.walletCardBonusOffer.findUnique({
      where: { walletCardId },
    });
    expect(afterCheck).not.toBeNull();
    expect(afterCheck?.spendRequirementCents).toBe(300000);
    expect(afterCheck?.windowMonths).toBe(3);
    expect(afterCheck?.bonusPoints).toBe(60000);

    // Verify idempotency: safe to run multiple times without duplicate rows
    const secondBonusRes = await request(app)
      .get("/api/v1/bonus-offers")
      .set("Cookie", userCookie);
    expect(secondBonusRes.status).toBe(200);
    expect(secondBonusRes.body.bonuses).toHaveLength(1);

    const afterSecondCheck = await prisma.walletCardBonusOffer.findUnique({
      where: { walletCardId },
    });
    expect(afterSecondCheck?.id).toBe(afterCheck?.id);
  });
});
