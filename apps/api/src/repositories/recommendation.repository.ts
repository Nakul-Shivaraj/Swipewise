import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.js";
import { RankableCard } from "../domain/rank-cards.js";
import { DEFAULT_USER_TIME_ZONE } from "../domain/dates/user-date.js";

export class RecommendationRepository {
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

  /**
   * Fetches all wallet cards owned by the given userId along with their card,
   * rewards program, reward rules, rotating categories, and quarter activations.
   * Scoped strictly to userId.
   */
  async findWalletCardsByUserId(userId: string): Promise<RankableCard[]> {
    const walletCards = await this.prisma.walletCard.findMany({
      where: { userId },
      include: {
        quarterActivations: true,
        card: {
          include: {
            program: true,
            rewardRules: true,
            rotatingCategories: true,
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
      rotatingRules: wc.card.rotatingCategories.map((rc) => ({
        quarter: rc.quarter,
        category: rc.category,
        rateX100: rc.rateX100,
        capCents: rc.capCents,
      })),
      activatedQuarters: wc.quarterActivations.map((qa) => qa.quarter),
    }));
  }
}

export const recommendationRepo = new RecommendationRepository();
