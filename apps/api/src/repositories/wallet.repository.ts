import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.js";
import { CatalogCardItem } from "./catalog.repository.js";
import { PaymentReminderCardInput } from "../domain/payment-reminders.js";
import { RotatingReminderCardInput } from "../domain/rotating-categories.js";
import {
  DEFAULT_USER_TIME_ZONE,
  resolveCurrentAndNextQuarters,
} from "../domain/dates/user-date.js";

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
  activatedQuarters: string[];
  rotatingQuarters: {
    currentQuarter: {
      quarter: string;
      isActivated: boolean;
      categories: Array<{
        category: "GROCERIES" | "DINING" | "GAS" | "TRAVEL";
        rateX100: number;
        capCents: number | null;
      }>;
    };
    nextQuarter: {
      quarter: string;
      isActivated: boolean;
      categories: Array<{
        category: "GROCERIES" | "DINING" | "GAS" | "TRAVEL";
        rateX100: number;
        capCents: number | null;
      }>;
    };
  } | null;
  card: CatalogCardItem;
}

const WALLET_CARD_INCLUDE = {
  user: {
    select: {
      timeZone: true,
    },
  },
  paymentSetting: true,
  paidCycles: true,
  quarterActivations: true,
  card: {
    include: {
      program: true,
      rewardRules: true,
      rotatingCategories: true,
    },
  },
} as const;

export class WalletRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient = defaultPrisma) {
    this.prisma = prisma;
  }

  async findUserTimeZone(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timeZone: true },
    });
    return user?.timeZone || DEFAULT_USER_TIME_ZONE;
  }

  private mapToDetails(
    wc: {
      id: string;
      userId: string;
      cardId: string;
      nickname: string | null;
      openedDate: Date | null;
      createdAt: Date;
      updatedAt: Date;
      user?: {
        timeZone: string;
      } | null;
      paymentSetting?: {
        dueDay: number;
        isAutopay: boolean;
      } | null;
      paidCycles?: Array<{
        cycleYearMonth: string;
      }>;
      quarterActivations?: Array<{
        quarter: string;
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
        rotatingCategories?: Array<{
          quarter: string;
          category: string;
          rateX100: number;
          capCents: number | null;
        }>;
      };
    },
    now: Date = new Date(),
  ): WalletCardWithDetails {
    const activatedQuarters = wc.quarterActivations
      ? wc.quarterActivations.map((qa) => qa.quarter)
      : [];
    const rotatingCats = wc.card.rotatingCategories ?? [];
    const timeZone = wc.user?.timeZone || DEFAULT_USER_TIME_ZONE;
    const [currentQuarter, nextQuarter] = resolveCurrentAndNextQuarters({
      now,
      timeZone,
    });

    const currentCategories = rotatingCats
      .filter((rc) => rc.quarter === currentQuarter)
      .map((rc) => ({
        category: rc.category as "GROCERIES" | "DINING" | "GAS" | "TRAVEL",
        rateX100: rc.rateX100,
        capCents: rc.capCents,
      }));
    const nextCategories = rotatingCats
      .filter((rc) => rc.quarter === nextQuarter)
      .map((rc) => ({
        category: rc.category as "GROCERIES" | "DINING" | "GAS" | "TRAVEL",
        rateX100: rc.rateX100,
        capCents: rc.capCents,
      }));

    const hasRotatingSchedule =
      rotatingCats.length > 0 ||
      currentCategories.length > 0 ||
      nextCategories.length > 0;

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
      activatedQuarters,
      rotatingQuarters: hasRotatingSchedule
        ? {
            currentQuarter: {
              quarter: currentQuarter,
              isActivated: activatedQuarters.includes(currentQuarter),
              categories: currentCategories,
            },
            nextQuarter: {
              quarter: nextQuarter,
              isActivated: activatedQuarters.includes(nextQuarter),
              categories: nextCategories,
            },
          }
        : null,
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
        rotatingCategories: rotatingCats.map((rc) => ({
          quarter: rc.quarter,
          category: rc.category as "GROCERIES" | "DINING" | "GAS" | "TRAVEL",
          rateX100: rc.rateX100,
          capCents: rc.capCents,
        })),
      },
    };
  }

  async findWalletCardsByUserId(
    userId: string,
    now: Date = new Date(),
  ): Promise<WalletCardWithDetails[]> {
    const walletCards = await this.prisma.walletCard.findMany({
      where: { userId },
      include: WALLET_CARD_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return walletCards.map((wc) => this.mapToDetails(wc, now));
  }

  async findWalletCardByIdAndUserId(
    id: string,
    userId: string,
    now: Date = new Date(),
  ): Promise<WalletCardWithDetails | null> {
    const wc = await this.prisma.walletCard.findFirst({
      where: { id, userId },
      include: WALLET_CARD_INCLUDE,
    });

    if (!wc) return null;
    return this.mapToDetails(wc, now);
  }

  async createWalletCard(
    data: {
      userId: string;
      cardId: string;
      nickname?: string | null;
      openedDate?: Date | null;
    },
    now: Date = new Date(),
  ): Promise<WalletCardWithDetails> {
    const catalogOffer = await this.prisma.bonusOffer.findUnique({
      where: { cardId: data.cardId },
    });

    const created = await this.prisma.walletCard.create({
      data: {
        userId: data.userId,
        cardId: data.cardId,
        nickname: data.nickname ?? null,
        openedDate: data.openedDate ?? null,
        ...(catalogOffer
          ? {
              bonusOffer: {
                create: {
                  spendRequirementCents: catalogOffer.spendRequirementCents,
                  windowMonths: catalogOffer.windowMonths,
                  bonusPoints: catalogOffer.bonusPoints,
                },
              },
            }
          : {}),
      },
      include: WALLET_CARD_INCLUDE,
    });

    return this.mapToDetails(created, now);
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

  async activateQuarter(
    walletCardId: string,
    userId: string,
    quarter: string,
    activatedAt: Date,
  ): Promise<{
    activation: {
      walletCardId: string;
      quarter: string;
      activatedAt: string;
    };
    walletCard: WalletCardWithDetails;
  } | null> {
    const existing = await this.prisma.walletCard.findFirst({
      where: { id: walletCardId, userId },
    });

    if (!existing) return null;

    const saved = await this.prisma.walletCardQuarterActivation.upsert({
      where: {
        walletCardId_quarter: {
          walletCardId,
          quarter,
        },
      },
      update: {
        activatedAt,
      },
      create: {
        walletCardId,
        quarter,
        activatedAt,
      },
    });

    await this.prisma.notification.updateMany({
      where: {
        userId,
        dismissedAt: null,
        dedupeKey: `ROTATING_CATEGORY:${walletCardId}:${quarter}`,
      },
      data: {
        dismissedAt: activatedAt,
      },
    });

    const updatedCard = await this.findWalletCardByIdAndUserId(
      walletCardId,
      userId,
      activatedAt,
    );
    if (!updatedCard) return null;

    return {
      activation: {
        walletCardId: saved.walletCardId,
        quarter: saved.quarter,
        activatedAt: saved.activatedAt.toISOString(),
      },
      walletCard: updatedCard,
    };
  }

  async findRotatingReminderCardsByUserId(
    userId: string,
  ): Promise<RotatingReminderCardInput[]> {
    const walletCards = await this.prisma.walletCard.findMany({
      where: { userId },
      include: {
        card: {
          include: {
            rotatingCategories: true,
          },
        },
        quarterActivations: true,
      },
    });

    return walletCards
      .filter((wc) => wc.card.rotatingCategories.length > 0)
      .map((wc) => ({
        walletCardId: wc.id,
        userId: wc.userId,
        cardDisplayName: wc.nickname || wc.card.name,
        rotatingQuarters: Array.from(
          new Set(wc.card.rotatingCategories.map((rc) => rc.quarter)),
        ),
        activatedQuarters: wc.quarterActivations.map((qa) => qa.quarter),
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
