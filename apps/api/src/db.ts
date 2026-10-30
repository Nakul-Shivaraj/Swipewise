import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type pg from "pg";

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Ignore if .env is missing (e.g., in CI or Vercel where env vars are injected)
  }
}

export interface DatabaseConfig {
  connectionString: string | undefined;
  schema: string | undefined;
}

export function resolveDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): DatabaseConfig {
  const isTest = env.NODE_ENV === "test" || Boolean(env.VITEST);
  const connectionString = isTest ? env.DATABASE_URL_TEST : env.DATABASE_URL;

  let schema: string | undefined;
  if (connectionString) {
    try {
      const parsed = new URL(connectionString);
      schema = parsed.searchParams.get("schema") ?? undefined;
    } catch {
      schema = undefined;
    }
  }

  if (isTest) {
    const resolvedSchema = schema ?? "test";
    if (resolvedSchema.toLowerCase() === "public") {
      throw new Error(
        "Test database configuration must never use the public schema (expected schema=test).",
      );
    }
    return { connectionString, schema: resolvedSchema };
  }

  return { connectionString, schema };
}

export function createPrismaClient(
  env: NodeJS.ProcessEnv = process.env,
  customPool?: pg.Pool,
): PrismaClient {
  const { connectionString, schema } = resolveDatabaseConfig(env);
  const adapter = customPool
    ? new PrismaPg(customPool, { schema })
    : new PrismaPg({ connectionString }, { schema });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
