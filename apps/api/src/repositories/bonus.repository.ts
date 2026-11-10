import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.js";
import { calculateBonusProgress } from "../domain/bonus-tracker.js";
import {
  BonusOfferProgressItem,
  SpendEntry as SpendEntryDto,
} from "@swipewise/shared";

export class BonusRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient = defaultPrisma) {
    this.prisma = prisma;
  }

  async backfillWalletCardBonusOffers(): Promise<number> {
    const walletCardsWithoutOffer = await this.prisma.walletCard.findMany({
      where: {
        bonusOffer: null,
        card: {
          bonusOffer: {
            isNot: null,
          },
        },
      },
      include: {
        card: {
          include: {
            bonusOffer: true,
          },
        },
      },
    });

    let count = 0;
    for (const wc of walletCardsWithoutOffer) {
      if (wc.card.bonusOffer) {
        await this.prisma.walletCardBonusOffer.upsert({
          where: { walletCardId: wc.id },
          create: {
            walletCardId: wc.id,
            spendRequirementCents: wc.card.bonusOffer.spendRequirementCents,
            windowMonths: wc.card.bonusOffer.windowMonths,
            bonusPoints: wc.card.bonusOffer.bonusPoints,
          },
          update: {},
        });
        count++;
      }
    }

    return count;
  }

  async getUserBonusOffers(
    userId: string,
    now: Date = new Date(),
  ): Promise<BonusOfferProgressItem[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timeZone: true },
    });
    const timeZone = user?.timeZone || "America/Los_Angeles";

    const walletCards = await this.prisma.walletCard.findMany({
      where: { userId },
      include: {
        card: {
          include: {
            bonusOffer: true,
          },
        },
        bonusOffer: true,
        spendEntries: {
          orderBy: { date: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const results: BonusOfferProgressItem[] = [];

    for (const wc of walletCards) {
      let activeOffer = wc.bonusOffer;

      // If wallet card does not yet have a copied bonus offer but catalog card does, copy it
      if (!activeOffer && wc.card.bonusOffer) {
        activeOffer = await this.prisma.walletCardBonusOffer.create({
          data: {
            walletCardId: wc.id,
            spendRequirementCents: wc.card.bonusOffer.spendRequirementCents,
            windowMonths: wc.card.bonusOffer.windowMonths,
            bonusPoints: wc.card.bonusOffer.bonusPoints,
          },
        });
      }

      if (!activeOffer) continue;

      const progress = calculateBonusProgress({
        now,
        timeZone,
        openedDate: wc.openedDate,
        windowMonths: activeOffer.windowMonths,
        requiredSpendCents: activeOffer.spendRequirementCents,
        spendEntries: wc.spendEntries.map((se) => ({
          amountCents: se.amountCents,
          date: se.date,
          note: se.note,
        })),
      });

      const spendEntriesDto: SpendEntryDto[] = wc.spendEntries.map((se) => ({
        id: se.id,
        walletCardId: se.walletCardId,
        walletCardBonusOfferId: se.walletCardBonusOfferId,
        amountCents: se.amountCents,
        date:
          typeof se.date === "string"
            ? (se.date as string).slice(0, 10)
            : se.date.toISOString().slice(0, 10),
        note: se.note,
        createdAt: se.createdAt.toISOString(),
        updatedAt: se.updatedAt.toISOString(),
      }));

      results.push({
        walletCardId: wc.id,
        cardName: wc.card.name,
        cardNickname: wc.nickname,
        cardArtColor: wc.card.artColor,
        bonusOfferId: activeOffer.id,
        requiredSpendCents: activeOffer.spendRequirementCents,
        spendRequirementCents: activeOffer.spendRequirementCents,
        windowMonths: activeOffer.windowMonths,
        bonusPoints: activeOffer.bonusPoints,
        openedDate: wc.openedDate
          ? typeof wc.openedDate === "string"
            ? (wc.openedDate as string).slice(0, 10)
            : wc.openedDate.toISOString().slice(0, 10)
          : null,
        deadline: progress.deadline,
        daysLeft: progress.daysLeft,
        spentCents: progress.spentCents,
        remainingCents: progress.remainingCents,
        progressPercent: progress.progressPercent,
        status: progress.status,
        requiresOpenDate: progress.requiresOpenDate,
        spendEntries: spendEntriesDto,
      });
    }

    return results;
  }

  async getBonusOfferByWalletCardId(
    walletCardId: string,
    userId: string,
    now: Date = new Date(),
  ): Promise<BonusOfferProgressItem | null> {
    const wc = await this.prisma.walletCard.findFirst({
      where: { id: walletCardId, userId },
      include: {
        user: { select: { timeZone: true } },
        card: { include: { bonusOffer: true } },
        bonusOffer: true,
        spendEntries: { orderBy: { date: "desc" } },
      },
    });

    if (!wc) return null;

    let activeOffer = wc.bonusOffer;
    if (!activeOffer && wc.card.bonusOffer) {
      activeOffer = await this.prisma.walletCardBonusOffer.create({
        data: {
          walletCardId: wc.id,
          spendRequirementCents: wc.card.bonusOffer.spendRequirementCents,
          windowMonths: wc.card.bonusOffer.windowMonths,
          bonusPoints: wc.card.bonusOffer.bonusPoints,
        },
      });
    }

    if (!activeOffer) return null;

    const timeZone = wc.user?.timeZone || "America/Los_Angeles";
    const progress = calculateBonusProgress({
      now,
      timeZone,
      openedDate: wc.openedDate,
      windowMonths: activeOffer.windowMonths,
      requiredSpendCents: activeOffer.spendRequirementCents,
      spendEntries: wc.spendEntries.map((se) => ({
        amountCents: se.amountCents,
        date: se.date,
        note: se.note,
      })),
    });

    const spendEntriesDto: SpendEntryDto[] = wc.spendEntries.map((se) => ({
      id: se.id,
      walletCardId: se.walletCardId,
      walletCardBonusOfferId: se.walletCardBonusOfferId,
      amountCents: se.amountCents,
      date:
        typeof se.date === "string"
          ? (se.date as string).slice(0, 10)
          : se.date.toISOString().slice(0, 10),
      note: se.note,
      createdAt: se.createdAt.toISOString(),
      updatedAt: se.updatedAt.toISOString(),
    }));

    return {
      walletCardId: wc.id,
      cardName: wc.card.name,
      cardNickname: wc.nickname,
      cardArtColor: wc.card.artColor,
      bonusOfferId: activeOffer.id,
      requiredSpendCents: activeOffer.spendRequirementCents,
      spendRequirementCents: activeOffer.spendRequirementCents,
      windowMonths: activeOffer.windowMonths,
      bonusPoints: activeOffer.bonusPoints,
      openedDate: wc.openedDate
        ? typeof wc.openedDate === "string"
          ? (wc.openedDate as string).slice(0, 10)
          : wc.openedDate.toISOString().slice(0, 10)
        : null,
      deadline: progress.deadline,
      daysLeft: progress.daysLeft,
      spentCents: progress.spentCents,
      remainingCents: progress.remainingCents,
      progressPercent: progress.progressPercent,
      status: progress.status,
      requiresOpenDate: progress.requiresOpenDate,
      spendEntries: spendEntriesDto,
    };
  }

  async addSpendEntry(
    userId: string,
    walletCardId: string,
    data: {
      amountCents: number;
      date: string;
      note?: string | null;
    },
  ): Promise<SpendEntryDto | null> {
    const wc = await this.prisma.walletCard.findFirst({
      where: { id: walletCardId, userId },
      include: {
        bonusOffer: true,
        card: { include: { bonusOffer: true } },
      },
    });

    if (!wc) return null;

    let bonusOfferId = wc.bonusOffer?.id;
    if (!bonusOfferId && wc.card.bonusOffer) {
      const createdOffer = await this.prisma.walletCardBonusOffer.create({
        data: {
          walletCardId: wc.id,
          spendRequirementCents: wc.card.bonusOffer.spendRequirementCents,
          windowMonths: wc.card.bonusOffer.windowMonths,
          bonusPoints: wc.card.bonusOffer.bonusPoints,
        },
      });
      bonusOfferId = createdOffer.id;
    }

    const dateObj = new Date(`${data.date}T00:00:00.000Z`);

    const created = await this.prisma.spendEntry.create({
      data: {
        walletCardId: wc.id,
        walletCardBonusOfferId: bonusOfferId ?? null,
        amountCents: data.amountCents,
        date: dateObj,
        note: data.note ?? null,
      },
    });

    return {
      id: created.id,
      walletCardId: created.walletCardId,
      walletCardBonusOfferId: created.walletCardBonusOfferId,
      amountCents: created.amountCents,
      date: data.date,
      note: created.note,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updateSpendEntry(
    userId: string,
    spendEntryId: string,
    data: {
      amountCents?: number;
      date?: string;
      note?: string | null;
    },
  ): Promise<SpendEntryDto | null> {
    const existing = await this.prisma.spendEntry.findUnique({
      where: { id: spendEntryId },
      include: { walletCard: true },
    });

    if (!existing || existing.walletCard.userId !== userId) {
      return null;
    }

    const updated = await this.prisma.spendEntry.update({
      where: { id: spendEntryId },
      data: {
        amountCents:
          data.amountCents !== undefined
            ? data.amountCents
            : existing.amountCents,
        date: data.date
          ? new Date(`${data.date}T00:00:00.000Z`)
          : existing.date,
        note: data.note !== undefined ? data.note : existing.note,
      },
    });

    return {
      id: updated.id,
      walletCardId: updated.walletCardId,
      walletCardBonusOfferId: updated.walletCardBonusOfferId,
      amountCents: updated.amountCents,
      date:
        data.date ??
        (typeof updated.date === "string"
          ? (updated.date as string).slice(0, 10)
          : updated.date.toISOString().slice(0, 10)),
      note: updated.note,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteSpendEntry(
    userId: string,
    spendEntryId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.spendEntry.findUnique({
      where: { id: spendEntryId },
      include: { walletCard: true },
    });

    if (!existing || existing.walletCard.userId !== userId) {
      return false;
    }

    await this.prisma.spendEntry.delete({
      where: { id: spendEntryId },
    });

    return true;
  }
}

export const bonusRepo = new BonusRepository();
