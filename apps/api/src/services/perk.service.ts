import { WalletCardPerkItem, WalletCardPerksResponse } from "@swipewise/shared";
import {
  calculatePerkUsageLeft,
  resolvePerkPeriodWindow,
} from "../domain/perks.js";
import {
  PerkRepository,
  perkRepo as defaultPerkRepo,
} from "../repositories/perk.repository.js";
import {
  UserRepository,
  userRepo as defaultUserRepo,
} from "../repositories/user.repository.js";

export interface MarkPerkUsageServiceInput {
  userId: string;
  walletCardId: string;
  perkId: string;
  usedCents?: number;
  isFull?: boolean;
  now?: Date;
}

export type MarkPerkUsageServiceResult =
  | { perk: WalletCardPerkItem; error?: undefined }
  | {
      perk?: undefined;
      error: {
        code: "NOT_FOUND" | "USAGE_EXCEEDS_PERK_AMOUNT" | "BAD_REQUEST";
        message: string;
      };
    };

export class PerkService {
  private perkRepo: PerkRepository;
  private userRepo: UserRepository;
  private nowProvider: () => Date;

  constructor(
    perkRepoInstance: PerkRepository = defaultPerkRepo,
    userRepoInstance: UserRepository = defaultUserRepo,
    nowProvider: () => Date = () => new Date(),
  ) {
    this.perkRepo = perkRepoInstance;
    this.userRepo = userRepoInstance;
    this.nowProvider = nowProvider;
  }

  async getWalletCardPerks(userId: string): Promise<WalletCardPerksResponse> {
    const now = this.nowProvider();
    const user = await this.userRepo.findById(userId);
    const timeZone = user?.timeZone ?? "America/Los_Angeles";

    const walletCards =
      await this.perkRepo.findWalletCardsWithPerksByUserId(userId);
    if (walletCards.length === 0) {
      return {
        perks: [],
        summary: {
          totalAmountCents: 0,
          totalUsedCents: 0,
          totalLeftCents: 0,
        },
      };
    }

    // Collect all card perks and their period keys
    const itemsWithWindows: Array<{
      walletCard: (typeof walletCards)[number];
      perk: (typeof walletCards)[number]["card"]["perks"][number];
      window: ReturnType<typeof resolvePerkPeriodWindow>;
    }> = [];

    const periodKeys = new Set<string>();
    const walletCardIds = walletCards.map((wc) => wc.id);

    for (const wc of walletCards) {
      for (const perk of wc.card.perks) {
        const window = resolvePerkPeriodWindow({
          now,
          timeZone,
          period: perk.period,
        });
        periodKeys.add(window.periodKey);
        itemsWithWindows.push({ walletCard: wc, perk, window });
      }
    }

    const usages = await this.perkRepo.findPerkUsages(
      walletCardIds,
      Array.from(periodKeys),
    );
    const usageMap = new Map<string, number>();
    for (const u of usages) {
      usageMap.set(`${u.walletCardId}:${u.perkId}:${u.periodKey}`, u.usedCents);
    }

    const perks: WalletCardPerkItem[] = [];
    let totalAmountCents = 0;
    let totalUsedCents = 0;
    let totalLeftCents = 0;

    for (const { walletCard, perk, window } of itemsWithWindows) {
      const key = `${walletCard.id}:${perk.id}:${window.periodKey}`;
      const usedCents = Math.min(perk.amountCents, usageMap.get(key) ?? 0);
      const usageCalc = calculatePerkUsageLeft(perk.amountCents, usedCents);

      totalAmountCents += perk.amountCents;
      totalUsedCents += usageCalc.usedCents;
      totalLeftCents += usageCalc.leftCents;

      perks.push({
        id: perk.id,
        perkId: perk.id,
        walletCardId: walletCard.id,
        cardName: walletCard.card.name,
        cardNickname: walletCard.nickname,
        cardArtColor: walletCard.card.artColor,
        perkName: perk.name,
        amountCents: perk.amountCents,
        period: perk.period,
        periodKey: window.periodKey,
        startDate: window.startDate,
        endDate: window.endDate,
        usedCents: usageCalc.usedCents,
        leftCents: usageCalc.leftCents,
        daysLeft: window.daysLeft,
        isUsed: usageCalc.isUsed,
      });
    }

    return {
      perks,
      summary: {
        totalAmountCents,
        totalUsedCents,
        totalLeftCents,
      },
    };
  }

  async markPerkUsage({
    userId,
    walletCardId,
    perkId,
    usedCents,
    isFull,
    now: overrideNow,
  }: MarkPerkUsageServiceInput): Promise<MarkPerkUsageServiceResult> {
    const now = overrideNow || this.nowProvider();

    // Multi-tenant check: card must exist and belong to the user
    const walletCard = await this.perkRepo.findWalletCardWithPerk(
      walletCardId,
      perkId,
    );
    if (!walletCard || walletCard.userId !== userId) {
      return {
        error: {
          code: "NOT_FOUND",
          message: "Perk or wallet card not found.",
        },
      };
    }

    const perk = walletCard.card.perks.find((p) => p.id === perkId);
    if (!perk) {
      return {
        error: {
          code: "NOT_FOUND",
          message: "Perk not found on card.",
        },
      };
    }

    let targetUsedCents: number;
    if (isFull) {
      targetUsedCents = perk.amountCents;
    } else if (usedCents !== undefined) {
      targetUsedCents = usedCents;
    } else {
      targetUsedCents = perk.amountCents;
    }

    if (targetUsedCents < 0) {
      return {
        error: {
          code: "BAD_REQUEST",
          message: "Usage cannot be negative.",
        },
      };
    }

    if (targetUsedCents > perk.amountCents) {
      return {
        error: {
          code: "USAGE_EXCEEDS_PERK_AMOUNT",
          message: "Usage cannot exceed the perk amount.",
        },
      };
    }

    const user = await this.userRepo.findById(userId);
    const timeZone = user?.timeZone ?? "America/Los_Angeles";
    const window = resolvePerkPeriodWindow({
      now,
      timeZone,
      period: perk.period,
    });

    await this.perkRepo.upsertPerkUsage(
      walletCardId,
      perkId,
      window.periodKey,
      targetUsedCents,
    );

    const usageCalc = calculatePerkUsageLeft(perk.amountCents, targetUsedCents);

    return {
      perk: {
        id: perk.id,
        perkId: perk.id,
        walletCardId: walletCard.id,
        cardName: walletCard.card.name,
        cardNickname: walletCard.nickname,
        cardArtColor: walletCard.card.artColor,
        perkName: perk.name,
        amountCents: perk.amountCents,
        period: perk.period,
        periodKey: window.periodKey,
        startDate: window.startDate,
        endDate: window.endDate,
        usedCents: usageCalc.usedCents,
        leftCents: usageCalc.leftCents,
        daysLeft: window.daysLeft,
        isUsed: usageCalc.isUsed,
      },
    };
  }
}

export const perkService = new PerkService();
