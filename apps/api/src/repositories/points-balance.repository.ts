import { PrismaClient } from "@prisma/client";
import { ProgramPointsBalanceItem } from "@swipewise/shared";
import { prisma as defaultPrisma } from "../db.js";
import {
  calculatePointsValueCents,
  PointsBalanceReminderInput,
} from "../domain/points-expiry.js";

export class PointsBalanceRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient = defaultPrisma) {
    this.prisma = prisma;
  }

  async findWalletProgramsWithBalancesByUserId(
    userId: string,
  ): Promise<ProgramPointsBalanceItem[]> {
    const walletCards = await this.prisma.walletCard.findMany({
      where: { userId },
      include: {
        card: {
          include: {
            program: true,
          },
        },
      },
    });

    const programMap = new Map<
      string,
      { programId: string; programName: string; centsPer100Points: number }
    >();

    for (const wc of walletCards) {
      const prog = wc.card.program;
      if (!programMap.has(prog.id)) {
        programMap.set(prog.id, {
          programId: prog.id,
          programName: prog.name,
          centsPer100Points: prog.centsPer100Points,
        });
      }
    }

    const programIds = Array.from(programMap.keys());
    if (programIds.length === 0) {
      return [];
    }

    const savedBalances = await this.prisma.programBalance.findMany({
      where: {
        userId,
        programId: { in: programIds },
      },
    });

    const balanceByProgramId = new Map(
      savedBalances.map((b) => [b.programId, b]),
    );

    const items = Array.from(programMap.values()).map((prog) => {
      const saved = balanceByProgramId.get(prog.programId);
      const expiryStr = saved
        ? saved.expiryDate.toISOString().slice(0, 10)
        : null;
      return {
        programId: prog.programId,
        programName: prog.programName,
        centsPer100Points: prog.centsPer100Points,
        balanceId: saved ? saved.id : null,
        pointsBalance: saved ? saved.pointsBalance : null,
        valueCents: saved
          ? calculatePointsValueCents(
              saved.pointsBalance,
              prog.centsPer100Points,
            )
          : null,
        expiryDate: expiryStr,
      };
    });

    items.sort((a, b) => a.programName.localeCompare(b.programName));
    return items;
  }

  async upsertProgramBalanceForUser(data: {
    userId: string;
    programId: string;
    pointsBalance: number;
    expiryDate: string;
  }): Promise<ProgramPointsBalanceItem | null> {
    const matchingWalletCard = await this.prisma.walletCard.findFirst({
      where: {
        userId: data.userId,
        card: {
          programId: data.programId,
        },
      },
      include: {
        card: {
          include: {
            program: true,
          },
        },
      },
    });

    if (!matchingWalletCard) {
      return null;
    }

    const program = matchingWalletCard.card.program;
    const expiryDateObj = new Date(`${data.expiryDate}T00:00:00.000Z`);

    const saved = await this.prisma.programBalance.upsert({
      where: {
        userId_programId: {
          userId: data.userId,
          programId: data.programId,
        },
      },
      update: {
        pointsBalance: data.pointsBalance,
        expiryDate: expiryDateObj,
      },
      create: {
        userId: data.userId,
        programId: data.programId,
        pointsBalance: data.pointsBalance,
        expiryDate: expiryDateObj,
      },
    });

    return {
      programId: program.id,
      programName: program.name,
      centsPer100Points: program.centsPer100Points,
      balanceId: saved.id,
      pointsBalance: saved.pointsBalance,
      valueCents: calculatePointsValueCents(
        saved.pointsBalance,
        program.centsPer100Points,
      ),
      expiryDate: saved.expiryDate.toISOString().slice(0, 10),
    };
  }

  async findReminderBalancesByUserId(
    userId: string,
  ): Promise<PointsBalanceReminderInput[]> {
    const walletCards = await this.prisma.walletCard.findMany({
      where: { userId },
      select: {
        card: {
          select: {
            programId: true,
          },
        },
      },
    });

    const walletProgramIds = Array.from(
      new Set(walletCards.map((wc) => wc.card.programId)),
    );
    if (walletProgramIds.length === 0) {
      return [];
    }

    const balances = await this.prisma.programBalance.findMany({
      where: {
        userId,
        programId: { in: walletProgramIds },
      },
      include: {
        program: true,
      },
    });

    return balances.map((b) => ({
      balanceId: b.id,
      userId: b.userId,
      programId: b.programId,
      programName: b.program.name,
      centsPer100Points: b.program.centsPer100Points,
      pointsBalance: b.pointsBalance,
      expiryDate: b.expiryDate.toISOString().slice(0, 10),
    }));
  }
}

export const pointsBalanceRepo = new PointsBalanceRepository();
