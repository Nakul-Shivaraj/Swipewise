import {
  CatalogRepository,
  catalogRepo,
} from "../repositories/catalog.repository.js";
import {
  WalletRepository,
  walletRepo,
} from "../repositories/wallet.repository.js";
import {
  AddWalletCardRequest,
  MarkCyclePaidRequest,
  UpdatePaymentSettingsRequest,
  UpdateWalletCardRequest,
} from "@swipewise/shared";
import {
  DEFAULT_USER_TIME_ZONE,
  resolveCurrentAndNextQuarters,
} from "../domain/dates/user-date.js";

export class WalletService {
  private walletRepo: WalletRepository;
  private catalogRepo: CatalogRepository;

  constructor(
    walletRepoInstance: WalletRepository = walletRepo,
    catalogRepoInstance: CatalogRepository = catalogRepo,
  ) {
    this.walletRepo = walletRepoInstance;
    this.catalogRepo = catalogRepoInstance;
  }

  async getCatalogCards() {
    return this.catalogRepo.findAllCards();
  }

  async getWalletCards(userId: string, now: Date = new Date()) {
    return this.walletRepo.findWalletCardsByUserId(userId, now);
  }

  async addWalletCard(
    userId: string,
    input: AddWalletCardRequest,
    now: Date = new Date(),
  ) {
    const catalogCard = await this.catalogRepo.findCardById(input.cardId);
    if (!catalogCard) {
      return {
        error: {
          code: "CARD_NOT_FOUND",
          message: "Card not found in catalog.",
        },
      };
    }

    let parsedDate: Date | null = null;
    if (input.openedDate) {
      parsedDate = new Date(`${input.openedDate}T00:00:00.000Z`);
    }

    const created = await this.walletRepo.createWalletCard(
      {
        userId,
        cardId: input.cardId,
        nickname: input.nickname ?? null,
        openedDate: parsedDate,
      },
      now,
    );

    return { walletCard: created };
  }

  async updateWalletCard(
    userId: string,
    id: string,
    input: UpdateWalletCardRequest,
  ) {
    const updated = await this.walletRepo.updateWalletCardNickname(
      id,
      userId,
      input.nickname ?? null,
    );

    if (!updated) {
      return {
        error: {
          code: "NOT_FOUND",
          message: "Wallet card not found.",
        },
      };
    }

    return { walletCard: updated };
  }

  async updatePaymentSettings(
    userId: string,
    walletCardId: string,
    input: UpdatePaymentSettingsRequest,
  ) {
    const updated = await this.walletRepo.upsertPaymentSettings(
      walletCardId,
      userId,
      {
        dueDay: input.dueDay,
        isAutopay: input.isAutopay,
      },
    );

    if (!updated) {
      return {
        error: {
          code: "NOT_FOUND",
          message: "Wallet card not found.",
        },
      };
    }

    return {
      walletCard: updated,
      paymentSettings: updated.paymentSettings,
    };
  }

  async markCyclePaid(
    userId: string,
    walletCardId: string,
    input: MarkCyclePaidRequest,
    now: Date = new Date(),
  ) {
    const paidCycle = await this.walletRepo.markCyclePaid(
      walletCardId,
      userId,
      input.cycleYearMonth,
      now,
    );

    if (!paidCycle) {
      return {
        error: {
          code: "NOT_FOUND",
          message: "Wallet card not found.",
        },
      };
    }

    return { paidCycle };
  }

  async getUserCurrentAndNextQuarters(
    userId: string,
    now: Date = new Date(),
  ): Promise<[string, string]> {
    const timeZone =
      typeof this.walletRepo.findUserTimeZone === "function"
        ? await this.walletRepo.findUserTimeZone(userId)
        : DEFAULT_USER_TIME_ZONE;
    return resolveCurrentAndNextQuarters({ now, timeZone });
  }

  async activateQuarter(
    userId: string,
    walletCardId: string,
    quarter: string,
    now: Date = new Date(),
  ) {
    const result = await this.walletRepo.activateQuarter(
      walletCardId,
      userId,
      quarter,
      now,
    );

    if (!result) {
      return {
        error: {
          code: "NOT_FOUND",
          message: "Wallet card not found.",
        },
      };
    }

    return {
      activation: result.activation,
      walletCard: result.walletCard,
    };
  }

  async removeWalletCard(userId: string, id: string) {
    const deleted = await this.walletRepo.deleteWalletCard(id, userId);
    if (!deleted) {
      return {
        error: {
          code: "NOT_FOUND",
          message: "Wallet card not found.",
        },
      };
    }

    return { success: true };
  }
}

export const walletService = new WalletService();
