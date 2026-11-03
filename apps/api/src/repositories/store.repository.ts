import { PrismaClient } from "@prisma/client";
import { MAX_STORE_SEARCH_RESULTS, StoreSearchResult } from "@swipewise/shared";
import { prisma as defaultPrisma } from "../db.js";

export class StoreRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient = defaultPrisma) {
    this.prisma = prisma;
  }

  /**
   * Case-insensitive store search by store name or alias using Prisma queries only.
   * Ordered by store name A–Z and capped at 10 results.
   */
  async searchStores(query: string): Promise<StoreSearchResult[]> {
    const stores = await this.prisma.store.findMany({
      where: {
        OR: [
          {
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            aliases: {
              some: {
                alias: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      },
      include: {
        aliases: {
          orderBy: {
            alias: "asc",
          },
        },
      },
      orderBy: {
        name: "asc",
      },
      take: MAX_STORE_SEARCH_RESULTS,
    });

    return stores.map((store) => ({
      id: store.id,
      name: store.name,
      category: store.category,
      aliases: store.aliases.map((a) => a.alias),
    }));
  }
}

export const storeRepo = new StoreRepository();
