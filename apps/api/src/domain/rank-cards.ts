import {
  CategoryName,
  DEFAULT_PURCHASE_AMOUNT_CENTS,
  RankedCardResult,
} from "@swipewise/shared";

export interface RankableRewardRule {
  category: CategoryName;
  rateX100: number;
  capCents?: number | null;
}

export interface RankableCard {
  walletCardId: string;
  cardId: string;
  name: string;
  issuer: string;
  artColor: string;
  isDemo: boolean;
  nickname?: string | null;
  annualFeeCents: number;
  baseRateX100: number;
  program: {
    name: string;
    centsPer100Points: number;
  };
  rules: RankableRewardRule[];
}

export interface RankCardsInput {
  cards: RankableCard[];
  category: CategoryName;
  amountCents?: number;
}

export function calculateCardRewardCents(
  _card: RankableCard,
  _category: CategoryName,
  _amountCents: number = DEFAULT_PURCHASE_AMOUNT_CENTS,
): {
  rewardCents: number;
  appliedRateX100: number;
  usedBaseRate: boolean;
  capCents: number | null;
  isCapExceeded: boolean;
} {
  throw new Error("Not implemented");
}

export function rankCards(_input: RankCardsInput): RankedCardResult[] {
  throw new Error("Not implemented");
}
