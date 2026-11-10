import { PrismaClient } from "@prisma/client";
import { PerkPeriodName } from "@swipewise/shared";
import { prisma as defaultPrisma } from "../db.js";
import {
  PerkReminderCardInput,
  resolvePerkPeriodWindow,
} from "../domain/perks.js";

export interface WalletCardWithCardPerks {
  id: string;
  userId: string;
  cardId: string;
  nickname: string | null;
  card: {
    id: string;
    name: string;
    artColor: string;
    perks: Array<{
      id: string;
      cardId: string;
      name: string;
      amountCents: number;
      period: PerkPeriodName;
    }>;
  };
}

export interface PerkUsageRecord {
  id: string;
  walletCardId: string;
  perkId: string;
  periodKey: string;
  usedCents: number;
}

export class PerkRepository {
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient = defaultPrisma) {
    this.prisma = prismaClient;
  }

  async findWalletCardsWithPerksByUserId(
    userId: string,
  ): Promise<WalletCardWithCardPerks[]> {
    const records = await this.prisma.walletCard.findMany({
      where: { userId },
      include: {
        card: {
          include: {
            perks: true,
          },
        },
      },
    });
    return records as unknown as WalletCardWithCardPerks[];
  }

  async findWalletCardWithPerk(
    walletCardId: string,
    perkId: string,
  ): Promise<WalletCardWithCardPerks | null> {
    const record = await this.prisma.walletCard.findUnique({
      where: { id: walletCardId },
      include: {
        card: {
          include: {
            perks: {
              where: { id: perkId },
            },
          },
        },
      },
    });
    return record as unknown as WalletCardWithCardPerks | null;
  }

  async findPerkUsages(
    walletCardIds: string[],
    periodKeys: string[],
  ): Promise<PerkUsageRecord[]> {
    if (walletCardIds.length === 0 || periodKeys.length === 0) {
      return [];
    }
    const records = await this.prisma.perkUsage.findMany({
      where: {
        walletCardId: { in: walletCardIds },
        periodKey: { in: periodKeys },
      },
    });
    return records;
  }

  async findPerkUsage(
    walletCardId: string,
    perkId: string,
    periodKey: string,
  ): Promise<PerkUsageRecord | null> {
    return this.prisma.perkUsage.findUnique({
      where: {
        walletCardId_perkId_periodKey: {
          walletCardId,
          perkId,
          periodKey,
        },
      },
    });
  }

  async upsertPerkUsage(
    walletCardId: string,
    perkId: string,
    periodKey: string,
    usedCents: number,
  ): Promise<PerkUsageRecord> {
    return this.prisma.perkUsage.upsert({
      where: {
        walletCardId_perkId_periodKey: {
          walletCardId,
          perkId,
          periodKey,
        },
      },
      create: {
        walletCardId,
        perkId,
        periodKey,
        usedCents,
      },
      update: {
        usedCents,
      },
    });
  }

  async findPerkReminderCardsByUserId(
    userId: string,
    now: Date = new Date(),
  ): Promise<PerkReminderCardInput[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timeZone: true },
    });
    const timeZone = user?.timeZone ?? "America/Los_Angeles";

    const walletCards = await this.findWalletCardsWithPerksByUserId(userId);
    if (walletCards.length === 0) {
      return [];
    }

    const cardInputs: PerkReminderCardInput[] = [];

    // Collect all unique period keys to batch fetch usages
    const cardPerkWindows: Array<{
      walletCard: WalletCardWithCardPerks;
      perk: WalletCardWithCardPerks["card"]["perks"][number];
      window: ReturnType<typeof resolvePerkPeriodWindow>;
    }> = [];

    const periodKeys = new Set<string>();
    const walletCardIds = walletCards.map((wc) => wc.id);

    for (const wc of walletCards) {
      for (const perk of wc.card.perks) {
        const window = resolvePerkPeriodWindow({
          now,
          timeZone,
          period: perk.period,
        });
        periodKeys.add(window.periodKey);
        cardPerkWindows.push({ walletCard: wc, perk, window });
      }
    }

    const usages = await this.findPerkUsages(
      walletCardIds,
      Array.from(periodKeys),
    );
    const usageMap = new Map<string, number>();
    for (const u of usages) {
      usageMap.set(`${u.walletCardId}:${u.perkId}:${u.periodKey}`, u.usedCents);
    }

    for (const { walletCard, perk, window } of cardPerkWindows) {
      const key = `${walletCard.id}:${perk.id}:${window.periodKey}`;
      const usedCents = usageMap.get(key) ?? 0;
      const cardDisplayName =
        walletCard.nickname?.trim() || walletCard.card.name;

      cardInputs.push({
        walletCardId: walletCard.id,
        userId,
        cardDisplayName,
        perkId: perk.id,
        perkName: perk.name,
        amountCents: perk.amountCents,
        period: perk.period,
        periodKey: window.periodKey,
        endDate: window.endDate,
        usedCents,
      });
    }

    return cardInputs;
  }
}

export const perkRepo = new PerkRepository();
