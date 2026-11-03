import { PrismaClient } from "@prisma/client";

export interface SeedDemoWalletOptions {
  email: string;
  env?: NodeJS.ProcessEnv;
  prisma?: PrismaClient;
}

export async function seedDemoWalletForUser(
  _options: SeedDemoWalletOptions,
): Promise<{ addedCount: number; totalWalletCards: number }> {
  throw new Error("Not implemented");
}
