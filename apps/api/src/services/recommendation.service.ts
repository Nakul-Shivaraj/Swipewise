import {
  CategoryName,
  DEFAULT_PURCHASE_AMOUNT_CENTS,
  RecommendationsResponse,
} from "@swipewise/shared";
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
   * Reusable by both category selection (#12) and store lookup (#13).
   */
  async getRecommendationsForCategory(
    userId: string,
    category: CategoryName,
    amountCents: number = DEFAULT_PURCHASE_AMOUNT_CENTS,
  ): Promise<RecommendationsResponse> {
    const cards = await this.repo.findWalletCardsByUserId(userId);
    const rankedCards = rankCards({
      cards,
      category,
      amountCents,
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
