import {
  CategoryName,
  DEFAULT_PURCHASE_AMOUNT_CENTS,
  RecommendationsResponse,
} from "@swipewise/shared";
import {
  DEFAULT_USER_TIME_ZONE,
  resolveUserQuarter,
} from "../domain/dates/user-date.js";
import { rankCards } from "../domain/rank-cards.js";
import {
  RecommendationRepository,
  recommendationRepo as defaultRecommendationRepo,
} from "../repositories/recommendation.repository.js";

export class RecommendationService {
  private repo: RecommendationRepository;

  constructor(repo: RecommendationRepository = defaultRecommendationRepo) {
    this.repo = repo;
  }

  /**
   * Ranks a user's wallet cards for the specified category and purchase amount.
   * Reusable by category selection (#12), store lookup (#13), and rotating categories (#23).
   */
  async getRecommendationsForCategory(
    userId: string,
    category: CategoryName,
    amountCents: number = DEFAULT_PURCHASE_AMOUNT_CENTS,
    now: Date = new Date(),
  ): Promise<RecommendationsResponse> {
    const cards = await this.repo.findWalletCardsByUserId(userId);
    const timeZone =
      typeof this.repo.findUserTimeZone === "function"
        ? await this.repo.findUserTimeZone(userId)
        : DEFAULT_USER_TIME_ZONE;
    const currentQuarter = resolveUserQuarter({ now, timeZone });

    const rankedCards = rankCards({
      cards,
      category,
      amountCents,
      currentQuarter,
    });

    return {
      category,
      amountCents,
      isEmptyWallet: cards.length === 0,
      rankedCards,
    };
  }
}

export const recommendationService = new RecommendationService();
