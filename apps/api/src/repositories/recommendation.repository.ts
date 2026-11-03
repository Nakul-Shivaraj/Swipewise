import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.js";
import { RankableCard } from "../domain/rank-cards.js";

export class RecommendationRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient = defaultPrisma) {
    this.prisma = prisma;
  }

  /**
   * Fetches all wallet cards owned by the given userId along with their card,
   * rewards program, and reward rules. Scoped strictly to userId.
   */
  async findWalletCardsByUserId(userId: string): Promise<RankableCard[]> {
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

    return walletCards.map((wc) => ({
      walletCardId: wc.id,
      cardId: wc.card.id,
      name: wc.card.name,
      issuer: wc.card.issuer,
      artColor: wc.card.artColor,
      isDemo: wc.card.isDemo,
      nickname: wc.nickname,
      annualFeeCents: wc.card.annualFeeCents,
      baseRateX100: wc.card.baseRateX100,
      program: {
        name: wc.card.program.name,
        centsPer100Points: wc.card.program.centsPer100Points,
      },
      rules: wc.card.rewardRules.map((rule) => ({
        category: rule.category,
        rateX100: rule.rateX100,
        capCents: rule.capCents,
      })),
    }));
  }
}

export const recommendationRepo = new RecommendationRepository();
