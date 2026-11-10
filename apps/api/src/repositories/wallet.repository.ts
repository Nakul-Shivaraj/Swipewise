import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.js";
import { CatalogCardItem } from "./catalog.repository.js";
import { PaymentReminderCardInput } from "../domain/payment-reminders.js";

export interface WalletCardWithDetails {
  id: string;
  userId: string;
  cardId: string;
  nickname: string | null;
  openedDate: string | null;
  createdAt: string;
  updatedAt: string;
  paymentSettings: {
    dueDay: number;
    isAutopay: boolean;
  } | null;
  paidCycles: string[];
  card: CatalogCardItem;
}

const WALLET_CARD_INCLUDE = {
  paymentSetting: true,
  paidCycles: true,
  card: {
    include: {
      program: true,
      rewardRules: true,
    },
  },
} as const;

export class WalletRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient = defaultPrisma) {
    this.prisma = prisma;
  }

  private mapToDetails(wc: {
    id: string;
    userId: string;
    cardId: string;
    nickname: string | null;
    openedDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
    paymentSetting?: {
      dueDay: number;
      isAutopay: boolean;
    } | null;
    paidCycles?: Array<{
      cycleYearMonth: string;
    }>;
    card: {
      id: string;
      name: string;
      issuer: string;
      artColor: string;
      isDemo: boolean;
      annualFeeCents: number;
      baseRateX100: number;
      program: {
        name: string;
        centsPer100Points: number;
      };
      rewardRules: Array<{
        category: string;
        rateX100: number;
        capCents: number | null;
      }>;
    };
  }): WalletCardWithDetails {
    return {
      id: wc.id,
      userId: wc.userId,
      cardId: wc.cardId,
      nickname: wc.nickname,
      openedDate: wc.openedDate
        ? wc.openedDate.toISOString().slice(0, 10)
        : null,
      createdAt: wc.createdAt.toISOString(),
      updatedAt: wc.updatedAt.toISOString(),
      paymentSettings: wc.paymentSetting
        ? {
            dueDay: wc.paymentSetting.dueDay,
            isAutopay: wc.paymentSetting.isAutopay,
          }
        : null,
      paidCycles: wc.paidCycles
        ? wc.paidCycles.map((pc) => pc.cycleYearMonth)
        : [],
      card: {
        id: wc.card.id,
        name: wc.card.name,
        issuer: wc.card.issuer,
        artColor: wc.card.artColor,
        isDemo: wc.card.isDemo,
        annualFeeCents: wc.card.annualFeeCents,
        baseRateX100: wc.card.baseRateX100,
        program: {
          name: wc.card.program.name,
          centsPer100Points: wc.card.program.centsPer100Points,
        },
        rates: wc.card.rewardRules.map((r) => ({
          category: r.category as "GROCERIES" | "DINING" | "GAS" | "TRAVEL",
          rateX100: r.rateX100,
          capCents: r.capCents,
        })),
      },
    };
  }

  async findWalletCardsByUserId(
    userId: string,
  ): Promise<WalletCardWithDetails[]> {
    const walletCards = await this.prisma.walletCard.findMany({
      where: { userId },
      include: WALLET_CARD_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return walletCards.map((wc) => this.mapToDetails(wc));
  }

  async findWalletCardByIdAndUserId(
    id: string,
    userId: string,
  ): Promise<WalletCardWithDetails | null> {
    const wc = await this.prisma.walletCard.findFirst({
      where: { id, userId },
      include: WALLET_CARD_INCLUDE,
    });

    if (!wc) return null;
    return this.mapToDetails(wc);
  }

  async createWalletCard(data: {
    userId: string;
    cardId: string;
    nickname?: string | null;
    openedDate?: Date | null;
  }): Promise<WalletCardWithDetails> {
    const created = await this.prisma.walletCard.create({
      data: {
        userId: data.userId,
        cardId: data.cardId,
        nickname: data.nickname ?? null,
        openedDate: data.openedDate ?? null,
      },
      include: WALLET_CARD_INCLUDE,
    });

    return this.mapToDetails(created);
  }

  async updateWalletCardNickname(
    id: string,
    userId: string,
    nickname: string | null,
  ): Promise<WalletCardWithDetails | null> {
    const existing = await this.prisma.walletCard.findFirst({
      where: { id, userId },
    });

    if (!existing) return null;

    const updated = await this.prisma.walletCard.update({
      where: { id },
      data: {
        nickname,
      },
      include: WALLET_CARD_INCLUDE,
    });

    return this.mapToDetails(updated);
  }

  async upsertPaymentSettings(
    walletCardId: string,
    userId: string,
    data: { dueDay: number; isAutopay: boolean },
  ): Promise<WalletCardWithDetails | null> {
    const existing = await this.prisma.walletCard.findFirst({
      where: { id: walletCardId, userId },
    });

    if (!existing) return null;

    await this.prisma.walletCardPaymentSetting.upsert({
      where: { walletCardId },
      update: {
        dueDay: data.dueDay,
        isAutopay: data.isAutopay,
      },
      create: {
        walletCardId,
        dueDay: data.dueDay,
        isAutopay: data.isAutopay,
      },
    });

    return this.findWalletCardByIdAndUserId(walletCardId, userId);
  }

  async markCyclePaid(
    walletCardId: string,
    userId: string,
    cycleYearMonth: string,
    paidAt: Date,
  ): Promise<{
    walletCardId: string;
    cycleYearMonth: string;
    paidAt: string;
  } | null> {
    const existing = await this.prisma.walletCard.findFirst({
      where: { id: walletCardId, userId },
    });

    if (!existing) return null;

    const saved = await this.prisma.walletCardPaidCycle.upsert({
      where: {
        walletCardId_cycleYearMonth: {
          walletCardId,
          cycleYearMonth,
        },
      },
      update: {
        paidAt,
      },
      create: {
        walletCardId,
        cycleYearMonth,
        paidAt,
      },
    });

    await this.prisma.notification.updateMany({
      where: {
        userId,
        dismissedAt: null,
        dedupeKey: {
          startsWith: `PAYMENT_DUE:${walletCardId}:${cycleYearMonth}:`,
        },
      },
      data: {
        dismissedAt: paidAt,
      },
    });

    return {
      walletCardId: saved.walletCardId,
      cycleYearMonth: saved.cycleYearMonth,
      paidAt: saved.paidAt.toISOString(),
    };
  }

  async findPaymentReminderCardsByUserId(
    userId: string,
  ): Promise<PaymentReminderCardInput[]> {
    const walletCards = await this.prisma.walletCard.findMany({
      where: {
        userId,
        paymentSetting: {
          isNot: null,
        },
      },
      include: {
        card: true,
        paymentSetting: true,
        paidCycles: true,
      },
    });

    return walletCards
      .filter((wc) => wc.paymentSetting !== null)
      .map((wc) => ({
        walletCardId: wc.id,
        userId: wc.userId,
        cardDisplayName: wc.nickname || wc.card.name,
        dueDay: wc.paymentSetting!.dueDay,
        isAutopay: wc.paymentSetting!.isAutopay,
        paidCycles: wc.paidCycles.map((pc) => pc.cycleYearMonth),
      }));
  }

  async deleteWalletCard(id: string, userId: string): Promise<boolean> {
    const existing = await this.prisma.walletCard.findFirst({
      where: { id, userId },
    });

    if (!existing) return false;

    await this.prisma.walletCard.delete({
      where: { id },
    });

    return true;
  }
}

export const walletRepo = new WalletRepository();
