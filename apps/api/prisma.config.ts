import { defineConfig } from "prisma/config";

try {
  process.loadEnvFile(".env");
} catch {
  // Ignore if .env is missing (e.g., in CI or when env vars are already set)
}

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
  migrations: {
    seed: "node --experimental-strip-types src/seed.ts",
  },
});
