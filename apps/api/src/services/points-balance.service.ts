import {
  ProgramPointsBalanceItem,
  UpsertPointsBalanceRequest,
} from "@swipewise/shared";
import {
  PointsBalanceRepository,
  pointsBalanceRepo as defaultPointsBalanceRepo,
} from "../repositories/points-balance.repository.js";

export class PointsBalanceService {
  private repo: PointsBalanceRepository;

  constructor(
    repoInstance: PointsBalanceRepository = defaultPointsBalanceRepo,
  ) {
    this.repo = repoInstance;
  }

  async getWalletProgramsWithBalances(
    userId: string,
  ): Promise<ProgramPointsBalanceItem[]> {
    return this.repo.findWalletProgramsWithBalancesByUserId(userId);
  }

  async upsertProgramBalance(
    userId: string,
    programId: string,
    input: UpsertPointsBalanceRequest,
  ): Promise<
    | { programBalance: ProgramPointsBalanceItem; error?: undefined }
    | {
        programBalance?: undefined;
        error: { code: "NOT_FOUND"; message: string };
      }
  > {
    const saved = await this.repo.upsertProgramBalanceForUser({
      userId,
      programId,
      pointsBalance: input.pointsBalance,
      expiryDate: input.expiryDate,
    });

    if (!saved) {
      return {
        error: {
          code: "NOT_FOUND",
          message: "Rewards program not found in your wallet.",
        },
      };
    }

    return { programBalance: saved };
  }
}

export const pointsBalanceService = new PointsBalanceService();
