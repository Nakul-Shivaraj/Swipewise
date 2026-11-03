import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.js";
import { CatalogCardItem } from "./catalog.repository.js";

export interface WalletCardWithDetails {
  id: string;
  userId: string;
  cardId: string;
  nickname: string | null;
  openedDate: string | null;
  createdAt: string;
  updatedAt: string;
  card: CatalogCardItem;
}

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
      include: {
        card: {
          include: {
            program: true,
            rewardRules: true,
          },
        },
      },
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
      include: {
        card: {
          include: {
            program: true,
            rewardRules: true,
          },
        },
      },
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
      include: {
        card: {
          include: {
            program: true,
            rewardRules: true,
          },
        },
      },
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
      include: {
        card: {
          include: {
            program: true,
            rewardRules: true,
          },
        },
      },
    });

    return this.mapToDetails(updated);
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
