import { PrismaClient, Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.js";
import {
  AdminCreateCardInput,
  AdminUpdateCardInput,
  AdminCreateStoreInput,
  AdminUpdateStoreInput,
} from "@swipewise/shared";

export class AdminRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient = defaultPrisma) {
    this.prisma = prisma;
  }

  async findAllCards() {
    return this.prisma.card.findMany({
      include: {
        program: true,
        rewardRules: true,
        perks: true,
        bonusOffer: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async findCardById(id: string) {
    return this.prisma.card.findUnique({
      where: { id },
      include: {
        program: true,
        rewardRules: true,
        perks: true,
        bonusOffer: true,
      },
    });
  }

  async createCard(userId: string, data: AdminCreateCardInput) {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.card.create({
        data: {
          name: data.name,
          issuer: data.issuer,
          artColor: data.artColor,
          isDemo: data.isDemo ?? true,
          annualFeeCents: data.annualFeeCents,
          baseRateX100: data.baseRateX100,
          programId: data.programId,
          isRetired: false,
          rewardRules: {
            create: data.rewardRules.map((r) => ({
              category: r.category,
              rateX100: r.rateX100,
              capCents: r.capCents ?? null,
            })),
          },
          perks: data.perks
            ? {
                create: data.perks.map((p) => ({
                  name: p.name,
                  amountCents: p.amountCents,
                  period: p.period,
                })),
              }
            : undefined,
          bonusOffer: data.bonusOffer
            ? {
                create: {
                  spendRequirementCents: data.bonusOffer.spendRequirementCents,
                  windowMonths: data.bonusOffer.windowMonths,
                  bonusPoints: data.bonusOffer.bonusPoints,
                },
              }
            : undefined,
        },
        include: {
          program: true,
          rewardRules: true,
          perks: true,
          bonusOffer: true,
        },
      });

      const snapshot = JSON.parse(JSON.stringify(card));

      await tx.auditLog.create({
        data: {
          userId,
          action: "CREATE_CARD",
          entityType: "CARD",
          entityId: card.id,
          before: Prisma.DbNull,
          after: snapshot,
        },
      });

      return card;
    });
  }

  async updateCard(userId: string, cardId: string, data: AdminUpdateCardInput) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.card.findUnique({
        where: { id: cardId },
        include: {
          program: true,
          rewardRules: true,
          perks: true,
          bonusOffer: true,
        },
      });

      if (!existing) {
        return null;
      }

      const beforeSnapshot = JSON.parse(JSON.stringify(existing));

      if (data.rewardRules !== undefined) {
        await tx.rewardRule.deleteMany({ where: { cardId } });
        if (data.rewardRules.length > 0) {
          await tx.rewardRule.createMany({
            data: data.rewardRules.map((r) => ({
              cardId,
              category: r.category,
              rateX100: r.rateX100,
              capCents: r.capCents ?? null,
            })),
          });
        }
      }

      if (data.perks !== undefined) {
        await tx.perk.deleteMany({ where: { cardId } });
        if (data.perks.length > 0) {
          await tx.perk.createMany({
            data: data.perks.map((p) => ({
              cardId,
              name: p.name,
              amountCents: p.amountCents,
              period: p.period,
            })),
          });
        }
      }

      if (data.bonusOffer !== undefined) {
        await tx.bonusOffer.deleteMany({ where: { cardId } });
        if (data.bonusOffer) {
          await tx.bonusOffer.create({
            data: {
              cardId,
              spendRequirementCents: data.bonusOffer.spendRequirementCents,
              windowMonths: data.bonusOffer.windowMonths,
              bonusPoints: data.bonusOffer.bonusPoints,
            },
          });
        }
      }

      const updated = await tx.card.update({
        where: { id: cardId },
        data: {
          name: data.name,
          issuer: data.issuer,
          artColor: data.artColor,
          isDemo: data.isDemo,
          annualFeeCents: data.annualFeeCents,
          baseRateX100: data.baseRateX100,
          programId: data.programId,
          isRetired: data.isRetired,
        },
        include: {
          program: true,
          rewardRules: true,
          perks: true,
          bonusOffer: true,
        },
      });

      const afterSnapshot = JSON.parse(JSON.stringify(updated));

      await tx.auditLog.create({
        data: {
          userId,
          action: "UPDATE_CARD",
          entityType: "CARD",
          entityId: cardId,
          before: beforeSnapshot,
          after: afterSnapshot,
        },
      });

      return updated;
    });
  }

  async retireCard(userId: string, cardId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.card.findUnique({
        where: { id: cardId },
        include: {
          program: true,
          rewardRules: true,
          perks: true,
          bonusOffer: true,
        },
      });

      if (!existing) {
        return null;
      }

      const beforeSnapshot = JSON.parse(JSON.stringify(existing));

      const updated = await tx.card.update({
        where: { id: cardId },
        data: { isRetired: true },
        include: {
          program: true,
          rewardRules: true,
          perks: true,
          bonusOffer: true,
        },
      });

      const afterSnapshot = JSON.parse(JSON.stringify(updated));

      await tx.auditLog.create({
        data: {
          userId,
          action: "RETIRE_CARD",
          entityType: "CARD",
          entityId: cardId,
          before: beforeSnapshot,
          after: afterSnapshot,
        },
      });

      return updated;
    });
  }

  async findAllStores() {
    return this.prisma.store.findMany({
      include: {
        aliases: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async findStoreById(id: string) {
    return this.prisma.store.findUnique({
      where: { id },
      include: {
        aliases: true,
      },
    });
  }

  async createStore(userId: string, data: AdminCreateStoreInput) {
    return this.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          name: data.name,
          category: data.category,
          aliases: {
            create: data.aliases.map((alias) => ({ alias })),
          },
        },
        include: {
          aliases: true,
        },
      });

      const snapshot = JSON.parse(JSON.stringify(store));

      await tx.auditLog.create({
        data: {
          userId,
          action: "CREATE_STORE",
          entityType: "STORE",
          entityId: store.id,
          before: Prisma.DbNull,
          after: snapshot,
        },
      });

      return store;
    });
  }

  async updateStore(
    userId: string,
    storeId: string,
    data: AdminUpdateStoreInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.store.findUnique({
        where: { id: storeId },
        include: { aliases: true },
      });

      if (!existing) {
        return null;
      }

      const beforeSnapshot = JSON.parse(JSON.stringify(existing));

      if (data.aliases !== undefined) {
        await tx.storeAlias.deleteMany({ where: { storeId } });
        if (data.aliases.length > 0) {
          await tx.storeAlias.createMany({
            data: data.aliases.map((alias) => ({
              storeId,
              alias,
            })),
          });
        }
      }

      const updated = await tx.store.update({
        where: { id: storeId },
        data: {
          name: data.name,
          category: data.category,
        },
        include: {
          aliases: true,
        },
      });

      const afterSnapshot = JSON.parse(JSON.stringify(updated));

      await tx.auditLog.create({
        data: {
          userId,
          action: "UPDATE_STORE",
          entityType: "STORE",
          entityId: storeId,
          before: beforeSnapshot,
          after: afterSnapshot,
        },
      });

      return updated;
    });
  }

  async findAuditLogs(limit = 100, offset = 0) {
    const logs = await this.prisma.auditLog.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      userEmail: log.user.email,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      before: log.before as Record<string, unknown> | null,
      after: log.after as Record<string, unknown>,
      createdAt: log.createdAt.toISOString(),
    }));
  }
}

export const adminRepo = new AdminRepository();
