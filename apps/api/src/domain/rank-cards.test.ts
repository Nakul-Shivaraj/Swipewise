import { describe, it, expect } from "vitest";
import { formatCents } from "@swipewise/shared";
import { DEMO_CARDS, DEMO_PROGRAMS } from "../seed-data.js";
import { rankCards, RankableCard } from "./rank-cards.js";

function buildSeedWalletCards(): RankableCard[] {
  return DEMO_CARDS.map((seedCard, idx) => {
    const program = DEMO_PROGRAMS.find((p) => p.name === seedCard.programName)!;
    return {
      walletCardId: `wallet-card-${idx + 1}`,
      cardId: `card-${idx + 1}`,
      name: seedCard.name,
      issuer: seedCard.issuer,
      artColor: seedCard.artColor,
      isDemo: seedCard.isDemo,
      nickname: null,
      annualFeeCents: seedCard.annualFeeCents,
      baseRateX100: seedCard.baseRateX100,
      program: {
        name: program.name,
        centsPer100Points: program.centsPer100Points,
      },
      rules: seedCard.rules.map((r) => ({
        category: r.category,
        rateX100: r.rateX100,
        capCents: r.capCents ?? null,
      })),
    };
  });
}

describe("rankCards (US-03)", () => {
  it("AC1: with the seed data, $100 at a groceries store ranks Mint Everyday $4.00, Basic Flat $1.50, Harbor Travel Plus $1.25", () => {
    const walletCards = buildSeedWalletCards();

    const ranked = rankCards({
      cards: walletCards,
      category: "GROCERIES",
      amountCents: 10000,
    });

    expect(ranked).toHaveLength(3);
    expect(
      ranked.map((c) => ({
        name: c.name,
        rewardCents: c.rewardCents,
        formatted: formatCents(c.rewardCents),
        rank: c.rank,
        isBestPick: c.isBestPick,
      })),
    ).toEqual([
      {
        name: "Mint Everyday",
        rewardCents: 400,
        formatted: "$4.00",
        rank: 1,
        isBestPick: true,
      },
      {
        name: "Basic Flat",
        rewardCents: 150,
        formatted: "$1.50",
        rank: 2,
        isBestPick: false,
      },
      {
        name: "Harbor Travel Plus",
        rewardCents: 125,
        formatted: "$1.25",
        rank: 3,
        isBestPick: false,
      },
    ]);
  });

  it("AC1: defaults purchase amount to $100 (10000 cents) when amountCents is omitted", () => {
    const walletCards = buildSeedWalletCards();

    const ranked = rankCards({
      cards: walletCards,
      category: "TRAVEL",
    });

    // Harbor Travel Plus: 2x * 1.25¢ = $2.50 (250 cents)
    // Basic Flat: 1.5% base = $1.50 (150 cents)
    // Mint Everyday: 1% base = $1.00 (100 cents)
    expect(
      ranked.map((c) => ({ name: c.name, rewardCents: c.rewardCents })),
    ).toEqual([
      { name: "Harbor Travel Plus", rewardCents: 250 },
      { name: "Basic Flat", rewardCents: 150 },
      { name: "Mint Everyday", rewardCents: 100 },
    ]);
  });

  it("AC2: cards without a rule for that category use their base rate", () => {
    const walletCards = buildSeedWalletCards();

    const ranked = rankCards({
      cards: walletCards,
      category: "GAS",
      amountCents: 10000,
    });

    // None of the seed cards have a GAS rule:
    // Basic Flat: 1.5% base -> 150 cents, usedBaseRate: true
    // Harbor Travel Plus: 1x * 1.25¢ base -> 125 cents, usedBaseRate: true
    // Mint Everyday: 1% base -> 100 cents, usedBaseRate: true
    expect(
      ranked.map((c) => ({
        name: c.name,
        rewardCents: c.rewardCents,
        appliedRateX100: c.appliedRateX100,
        usedBaseRate: c.usedBaseRate,
      })),
    ).toEqual([
      {
        name: "Basic Flat",
        rewardCents: 150,
        appliedRateX100: 150,
        usedBaseRate: true,
      },
      {
        name: "Harbor Travel Plus",
        rewardCents: 125,
        appliedRateX100: 100,
        usedBaseRate: true,
      },
      {
        name: "Mint Everyday",
        rewardCents: 100,
        appliedRateX100: 100,
        usedBaseRate: true,
      },
    ]);
  });

  it("AC3: splits a purchase that crosses the cap so the amount over the cap earns the base rate", () => {
    const cappedGroceriesCard: RankableCard = {
      walletCardId: "wc-capped",
      cardId: "card-capped",
      name: "Capped Grocer",
      issuer: "Demo Bank",
      artColor: "#2F8C55",
      isDemo: true,
      nickname: null,
      annualFeeCents: 0,
      baseRateX100: 100, // 1% base
      program: {
        name: "Cash Back",
        centsPer100Points: 100,
      },
      rules: [
        {
          category: "GROCERIES",
          rateX100: 500, // 5% up to $500.00 (50000 cents)
          capCents: 50000,
        },
      ],
    };

    const flatTwoPercentCard: RankableCard = {
      walletCardId: "wc-flat",
      cardId: "card-flat",
      name: "Steady Two",
      issuer: "Demo Bank",
      artColor: "#2F74D0",
      isDemo: true,
      nickname: null,
      annualFeeCents: 0,
      baseRateX100: 200, // 2% on everything
      program: {
        name: "Cash Back",
        centsPer100Points: 100,
      },
      rules: [],
    };

    // On an $800.00 (80000 cents) groceries purchase:
    // Capped Grocer: first $500 at 5% ($25.00 = 2500 cents) + remaining $300 at 1% ($3.00 = 300 cents) = $28.00 (2800 cents)
    // Steady Two: $800 at 2% = $16.00 (1600 cents)
    const ranked800 = rankCards({
      cards: [flatTwoPercentCard, cappedGroceriesCard],
      category: "GROCERIES",
      amountCents: 80000,
    });

    expect(ranked800[0]?.name).toBe("Capped Grocer");
    expect(ranked800[0]?.rewardCents).toBe(2800);
    expect(ranked800[0]?.isCapExceeded).toBe(true);
    expect(ranked800[0]?.capCents).toBe(50000);
    expect(ranked800[1]?.name).toBe("Steady Two");
    expect(ranked800[1]?.rewardCents).toBe(1600);
    expect(ranked800[1]?.isCapExceeded).toBe(false);

    // On a $2,500.00 (250000 cents) groceries purchase:
    // Capped Grocer: $500 at 5% (2500 cents) + $2,000 at 1% (2000 cents) = 4500 cents ($45.00)
    // Steady Two: $2,500 at 2% = 5000 cents ($50.00) -> overtakes Capped Grocer!
    const ranked2500 = rankCards({
      cards: [cappedGroceriesCard, flatTwoPercentCard],
      category: "GROCERIES",
      amountCents: 250000,
    });

    expect(ranked2500[0]?.name).toBe("Steady Two");
    expect(ranked2500[0]?.rewardCents).toBe(5000);
    expect(ranked2500[1]?.name).toBe("Capped Grocer");
    expect(ranked2500[1]?.rewardCents).toBe(4500);
    expect(ranked2500[1]?.isCapExceeded).toBe(true);
  });

  it("AC3: sums integer numerators across cap segments, divides by 1,000,000 once, and rounds half up (AGENTS.md §6)", () => {
    // Choose values where rounding each segment separately would differ from summing numerators then rounding once:
    // Segment 1: 33 cents * 300 (3x) * 125 (1.25c/pt) = 1,237,500 (1.2375 cents -> would round to 1 alone)
    // Segment 2: 21 cents * 100 (1x) * 125 (1.25c/pt) =   262,500 (0.2625 cents -> would round to 0 alone)
    // Sum of numerators = 1,500,000 -> 1.5 cents -> rounds half up to 2 cents!
    const card: RankableCard = {
      walletCardId: "wc-round",
      cardId: "card-round",
      name: "Precision Points",
      issuer: "Demo Bank",
      artColor: "#7454CF",
      isDemo: true,
      nickname: null,
      annualFeeCents: 0,
      baseRateX100: 100,
      program: {
        name: "Harbor Points",
        centsPer100Points: 125,
      },
      rules: [
        {
          category: "DINING",
          rateX100: 300,
          capCents: 33,
        },
      ],
    };

    const ranked = rankCards({
      cards: [card],
      category: "DINING",
      amountCents: 54,
    });

    expect(ranked[0]?.rewardCents).toBe(2);
  });

  it("AC4: breaks ties by lower annual fee first, then card name A–Z", () => {
    const cards: RankableCard[] = [
      {
        walletCardId: "wc-1",
        cardId: "c-1",
        name: "Zeta Rewards",
        issuer: "Demo Bank",
        artColor: "#2F8C55",
        isDemo: true,
        nickname: null,
        annualFeeCents: 0,
        baseRateX100: 200,
        program: { name: "Cash Back", centsPer100Points: 100 },
        rules: [],
      },
      {
        walletCardId: "wc-2",
        cardId: "c-2",
        name: "Alpha Premier",
        issuer: "Demo Bank",
        artColor: "#2F74D0",
        isDemo: true,
        nickname: null,
        annualFeeCents: 9500,
        baseRateX100: 200,
        program: { name: "Cash Back", centsPer100Points: 100 },
        rules: [],
      },
      {
        walletCardId: "wc-3",
        cardId: "c-3",
        name: "Alpha Everyday",
        issuer: "Demo Bank",
        artColor: "#958C7B",
        isDemo: true,
        nickname: null,
        annualFeeCents: 0,
        baseRateX100: 200,
        program: { name: "Cash Back", centsPer100Points: 100 },
        rules: [],
      },
    ];

    const ranked = rankCards({
      cards,
      category: "DINING",
      amountCents: 10000,
    });

    // All three earn $2.00 (200 cents).
    // Alpha Everyday ($0 fee, 'A') beats Zeta Rewards ($0 fee, 'Z'), which beats Alpha Premier ($95 fee).
    expect(ranked.map((c) => c.name)).toEqual([
      "Alpha Everyday",
      "Zeta Rewards",
      "Alpha Premier",
    ]);
  });

  it("AC5: returns an empty array when the user wallet has no cards", () => {
    const ranked = rankCards({
      cards: [],
      category: "GROCERIES",
      amountCents: 10000,
    });

    expect(ranked).toEqual([]);
  });
});
