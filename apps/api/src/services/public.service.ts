import {
  CategoryName,
  DEFAULT_PURCHASE_AMOUNT_CENTS,
  PublicRankedCardResult,
  PublicRecommendationsResponse,
  StoreSearchResponse,
} from "@swipewise/shared";
import { resolveUserQuarter } from "../domain/dates/user-date.js";
import { RankableCard, rankCards } from "../domain/rank-cards.js";
import {
  CatalogCardItem,
  CatalogRepository,
  catalogRepo as defaultCatalogRepo,
} from "../repositories/catalog.repository.js";
import {
  StoreRepository,
  storeRepo as defaultStoreRepo,
} from "../repositories/store.repository.js";
import { StoreService } from "./store.service.js";

export class PublicService {
  private catalogRepo: CatalogRepository;
  private storeService: StoreService;

  constructor(
    catalogRepo: CatalogRepository = defaultCatalogRepo,
    storeRepo: StoreRepository = defaultStoreRepo,
  ) {
    this.catalogRepo = catalogRepo;
    this.storeService = new StoreService(storeRepo);
  }

  async getCatalogCards(): Promise<{ cards: CatalogCardItem[] }> {
    const cards = await this.catalogRepo.findAllCards();
    return { cards };
  }

  async getRecommendationsForCategory(
    category: CategoryName,
    amountCents: number = DEFAULT_PURCHASE_AMOUNT_CENTS,
    now: Date = new Date(),
  ): Promise<PublicRecommendationsResponse> {
    const catalogCards = await this.catalogRepo.findAllCards();
    const currentQuarter = resolveUserQuarter({ now, timeZone: "UTC" });

    const rankableCards: RankableCard[] = catalogCards.map((card) => ({
      cardId: card.id,
      name: card.name,
      issuer: card.issuer,
      artColor: card.artColor,
      isDemo: card.isDemo,
      annualFeeCents: card.annualFeeCents,
      baseRateX100: card.baseRateX100,
      program: {
        name: card.program.name,
        centsPer100Points: card.program.centsPer100Points,
      },
      rules: card.rates.map((r) => ({
        category: r.category,
        rateX100: r.rateX100,
        capCents: r.capCents,
      })),
      rotatingRules: (card.rotatingCategories ?? []).map((rc) => ({
        quarter: rc.quarter,
        category: rc.category,
        rateX100: rc.rateX100,
        capCents: rc.capCents,
      })),
      activatedQuarters: [],
    }));

    const ranked = rankCards({
      cards: rankableCards,
      category,
      amountCents,
      currentQuarter,
    });

    const rankedCards: PublicRankedCardResult[] = ranked.map((item) => ({
      cardId: item.cardId,
      name: item.name,
      issuer: item.issuer,
      artColor: item.artColor,
      isDemo: item.isDemo,
      annualFeeCents: item.annualFeeCents,
      programName: item.programName,
      centsPer100Points: item.centsPer100Points,
      appliedRateX100: item.appliedRateX100,
      baseRateX100: item.baseRateX100,
      usedBaseRate: item.usedBaseRate,
      capCents: item.capCents,
      isCapExceeded: item.isCapExceeded,
      rewardCents: item.rewardCents,
      activationNote: item.activationNote ?? null,
      rank: item.rank,
      isBestPick: item.isBestPick,
    }));

    return {
      category,
      amountCents,
      bestCard: rankedCards[0] ?? null,
      rankedCards,
    };
  }

  async searchStores(query: string): Promise<StoreSearchResponse> {
    return this.storeService.searchStores(query);
  }
}

export const publicService = new PublicService();
