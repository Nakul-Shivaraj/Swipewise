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

/**
 * Pure reward calculation per AGENTS.md §6:
 * Reward value in cents = amountCents × rateX100 × centsPer100Points / 1_000_000.
 * Sum the integer numerators across cap segments, divide once, round half up.
 */
export function calculateCardRewardCents(
  card: RankableCard,
  category: CategoryName,
  amountCents: number = DEFAULT_PURCHASE_AMOUNT_CENTS,
): {
  rewardCents: number;
  appliedRateX100: number;
  usedBaseRate: boolean;
  capCents: number | null;
  isCapExceeded: boolean;
} {
  const matchingRule = card.rules.find((r) => r.category === category);
  const centsPer100PointsBig = BigInt(card.program.centsPer100Points);
  const baseRateBig = BigInt(card.baseRateX100);
  const totalAmountBig = BigInt(amountCents);

  if (!matchingRule) {
    const numerator = totalAmountBig * baseRateBig * centsPer100PointsBig;
    const rewardCents = Number((numerator + 500_000n) / 1_000_000n);
    return {
      rewardCents,
      appliedRateX100: card.baseRateX100,
      usedBaseRate: true,
      capCents: null,
      isCapExceeded: false,
    };
  }

  const ruleRateBig = BigInt(matchingRule.rateX100);
  const capCents = matchingRule.capCents ?? null;

  if (capCents !== null && amountCents > capCents) {
    const cappedAmountBig = BigInt(capCents);
    const overCapAmountBig = totalAmountBig - cappedAmountBig;

    const totalNumerator =
      cappedAmountBig * ruleRateBig * centsPer100PointsBig +
      overCapAmountBig * baseRateBig * centsPer100PointsBig;

    const rewardCents = Number((totalNumerator + 500_000n) / 1_000_000n);
    return {
      rewardCents,
      appliedRateX100: matchingRule.rateX100,
      usedBaseRate: false,
      capCents,
      isCapExceeded: true,
    };
  }

  const numerator = totalAmountBig * ruleRateBig * centsPer100PointsBig;
  const rewardCents = Number((numerator + 500_000n) / 1_000_000n);
  return {
    rewardCents,
    appliedRateX100: matchingRule.rateX100,
    usedBaseRate: false,
    capCents,
    isCapExceeded: false,
  };
}

/**
 * Pure ranking function for US-03 (Issue #12).
 * Ranks user wallet cards by rewardCents (descending), breaking ties by
 * lower annualFeeCents (ascending), then card name A–Z.
 */
export function rankCards(input: RankCardsInput): RankedCardResult[] {
  const amountCents = input.amountCents ?? DEFAULT_PURCHASE_AMOUNT_CENTS;

  const evaluated = input.cards.map((card) => {
    const calc = calculateCardRewardCents(card, input.category, amountCents);
    return {
      walletCardId: card.walletCardId,
      cardId: card.cardId,
      name: card.name,
      issuer: card.issuer,
      artColor: card.artColor,
      isDemo: card.isDemo,
      nickname: card.nickname ?? null,
      annualFeeCents: card.annualFeeCents,
      programName: card.program.name,
      centsPer100Points: card.program.centsPer100Points,
      appliedRateX100: calc.appliedRateX100,
      baseRateX100: card.baseRateX100,
      usedBaseRate: calc.usedBaseRate,
      capCents: calc.capCents,
      isCapExceeded: calc.isCapExceeded,
      rewardCents: calc.rewardCents,
    };
  });

  evaluated.sort((a, b) => {
    if (b.rewardCents !== a.rewardCents) {
      return b.rewardCents - a.rewardCents;
    }
    if (a.annualFeeCents !== b.annualFeeCents) {
      return a.annualFeeCents - b.annualFeeCents;
    }
    return a.name.localeCompare(b.name);
  });

  return evaluated.map((item, index) => ({
    ...item,
    rank: index + 1,
    isBestPick: index === 0,
  }));
}
