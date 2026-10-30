import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Ensure .env is loaded if not already in process.env
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  try {
    process.loadEnvFile(new URL('../../../.env', import.meta.url));
  } catch {
    try {
      process.loadEnvFile('.env');
    } catch {
      // Ignore
    }
  }
}

export interface DbClientOptions {
  url?: string;
  schema?: string;
}

export function getDatabaseConfig(): { url: string; schema?: string } {
  const isTest =
    process.env.NODE_ENV === 'test' || Boolean(process.env.DATABASE_URL_TEST);
  const connStr =
    (isTest ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL) ||
    process.env.DATABASE_URL ||
    '';

  let schema: string | undefined = isTest ? 'test' : undefined;
  try {
    const parsed = new URL(connStr);
    const paramSchema = parsed.searchParams.get('schema');
    if (paramSchema) {
      schema = paramSchema;
    }
  } catch {
    // fallback if non-standard URL
  }

  return { url: connStr, schema };
}

export function createPrismaClient(options: DbClientOptions = {}): PrismaClient {
  const config = getDatabaseConfig();
  const url = options.url || config.url;
  const schema = options.schema !== undefined ? options.schema : config.schema;

  const adapter = new PrismaPg(url, schema ? { schema } : undefined);
  return new PrismaClient({ adapter });
}

export const prisma = createPrismaClient();
