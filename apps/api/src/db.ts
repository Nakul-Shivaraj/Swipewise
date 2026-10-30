import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Ignore if .env is missing (e.g., in CI or Vercel where env vars are injected)
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
