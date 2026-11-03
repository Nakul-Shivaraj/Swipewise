import { describe, it, expect, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { StoreRepository } from "./store.repository.js";

describe("StoreRepository (US-04 / Issue #13)", () => {
  it("queries Prisma case-insensitively by name or alias, ordered A–Z, capped at 10", async () => {
    const findManyMock = vi.fn().mockResolvedValue([
      {
        id: "store-1",
        name: "Safeway",
        category: "GROCERIES",
        aliases: [{ alias: "Safeway Grocery" }, { alias: "safeway.com" }],
      },
    ]);

    const fakePrisma = {
      store: {
        findMany: findManyMock,
      },
    } as unknown as PrismaClient;

    const repo = new StoreRepository(fakePrisma);
    const result = await repo.searchStores("safeway");

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            name: {
              contains: "safeway",
              mode: "insensitive",
            },
          },
          {
            aliases: {
              some: {
                alias: {
                  contains: "safeway",
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
      take: 10,
    });

    expect(result).toEqual([
      {
        id: "store-1",
        name: "Safeway",
        category: "GROCERIES",
        aliases: ["Safeway Grocery", "safeway.com"],
      },
    ]);
  });
});
