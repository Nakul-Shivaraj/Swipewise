import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.js";

export interface CatalogCardItem {
  id: string;
  name: string;
  issuer: string;
  artColor: string;
  isDemo: boolean;
  annualFeeCents: number;
  baseRateX100: number;
  program: {
    name: string;
    centsPer100Points: number;
  };
  rates: Array<{
    category: "GROCERIES" | "DINING" | "GAS" | "TRAVEL";
    rateX100: number;
    capCents: number | null;
  }>;
  rotatingCategories?: Array<{
    quarter: string;
    category: "GROCERIES" | "DINING" | "GAS" | "TRAVEL";
    rateX100: number;
    capCents: number | null;
  }>;
}

export class CatalogRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient = defaultPrisma) {
    this.prisma = prisma;
  }

  async findAllCards(): Promise<CatalogCardItem[]> {
    const cards = await this.prisma.card.findMany({
      where: { isRetired: false },
      include: {
        program: true,
        rewardRules: true,
        rotatingCategories: true,
      },
      orderBy: { name: "asc" },
    });

    return cards.map((c) => ({
      id: c.id,
      name: c.name,
      issuer: c.issuer,
      artColor: c.artColor,
      isDemo: c.isDemo,
      annualFeeCents: c.annualFeeCents,
      baseRateX100: c.baseRateX100,
      program: {
        name: c.program.name,
        centsPer100Points: c.program.centsPer100Points,
      },
      rates: c.rewardRules.map((r) => ({
        category: r.category as "GROCERIES" | "DINING" | "GAS" | "TRAVEL",
        rateX100: r.rateX100,
        capCents: r.capCents,
      })),
      rotatingCategories: c.rotatingCategories.map((rc) => ({
        quarter: rc.quarter,
        category: rc.category as "GROCERIES" | "DINING" | "GAS" | "TRAVEL",
        rateX100: rc.rateX100,
        capCents: rc.capCents,
      })),
    }));
  }

  async findCardById(id: string): Promise<CatalogCardItem | null> {
    const card = await this.prisma.card.findUnique({
      where: { id },
      include: {
        program: true,
        rewardRules: true,
        rotatingCategories: true,
      },
    });

    if (!card) return null;

    return {
      id: card.id,
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
      rates: card.rewardRules.map((r) => ({
        category: r.category as "GROCERIES" | "DINING" | "GAS" | "TRAVEL",
        rateX100: r.rateX100,
        capCents: r.capCents,
      })),
      rotatingCategories: card.rotatingCategories.map((rc) => ({
        quarter: rc.quarter,
        category: rc.category as "GROCERIES" | "DINING" | "GAS" | "TRAVEL",
        rateX100: rc.rateX100,
        capCents: rc.capCents,
      })),
    };
  }
}

export const catalogRepo = new CatalogRepository();
