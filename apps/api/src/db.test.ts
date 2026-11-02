import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { createPrismaClient, resolveDatabaseConfig } from "./db.js";

describe("Project Structure & Database Setup (Issue #4)", () => {
  const rootDir = path.resolve(__dirname, "../../..");
  const apiDir = path.resolve(__dirname, "..");

  it("AC: .env.example lists variable names only with no values/secrets", () => {
    const envExamplePath = path.join(rootDir, ".env.example");
    expect(fs.existsSync(envExamplePath)).toBe(true);

    const content = fs.readFileSync(envExamplePath, "utf-8");
    const lines = content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));

    const keys = lines.map((line) => line.split("=")[0]);
    expect(keys).toContain("DATABASE_URL");
    expect(keys).toContain("DIRECT_URL");

    // Ensure no values/secrets are included
    for (const line of lines) {
      const parts = line.split("=");
      const value = parts.slice(1).join("=");
      expect(value).toBe("");
    }
  });

  it("AC: root and api package.json provide db:migrate and db:seed scripts", () => {
    const rootPkg = JSON.parse(
      fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"),
    );
    expect(rootPkg.scripts["db:migrate"]).toBeDefined();
    expect(rootPkg.scripts["db:seed"]).toBeDefined();

    const apiPkg = JSON.parse(
      fs.readFileSync(path.join(apiDir, "package.json"), "utf-8"),
    );
    expect(apiPkg.scripts["db:migrate"]).toBeDefined();
    expect(apiPkg.scripts["db:seed"]).toBeDefined();
  });

  it("AC: Prisma in apps/api is configured for PostgreSQL with schema and config", () => {
    const schemaPath = path.join(apiDir, "prisma/schema.prisma");
    expect(fs.existsSync(schemaPath)).toBe(true);

    const schemaContent = fs.readFileSync(schemaPath, "utf-8");
    expect(schemaContent).toContain('provider = "postgresql"');
    expect(schemaContent).toContain("generator client");

    const configPath = path.join(apiDir, "prisma.config.ts");
    expect(fs.existsSync(configPath)).toBe(true);

    const configContent = fs.readFileSync(configPath, "utf-8");
    expect(configContent).toContain("DIRECT_URL");
    expect(configContent).toContain("DATABASE_URL");
  });

  it("AC: README.md includes a Local setup section", () => {
    const readmePath = path.join(rootDir, "README.md");
    expect(fs.existsSync(readmePath)).toBe(true);

    const readmeContent = fs.readFileSync(readmePath, "utf-8");
    expect(readmeContent).toContain("## Local setup");
    expect(readmeContent).toContain("db:migrate");
    expect(readmeContent).toContain("db:seed");
  });

  it("AC (Issue #6): db.ts uses DATABASE_URL_TEST with schema=test in tests and never public", async () => {
    const testEnv: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      DATABASE_URL:
        "postgresql://user:pass@localhost:6543/postgres?pgbouncer=true&schema=public",
      DATABASE_URL_TEST:
        "postgresql://user:pass@localhost:6543/postgres?pgbouncer=true&schema=test",
    };

    const config = resolveDatabaseConfig(testEnv);
    expect(config.connectionString).toBe(testEnv.DATABASE_URL_TEST);
    expect(config.schema).toBe("test");

    // Verify Prisma queries target "test"."users" and never "public"
    const executedSql: string[] = [];
    const fakePool = new pg.Pool({
      connectionString: testEnv.DATABASE_URL_TEST,
    });
    fakePool.query = (async (queryConfig: { text: string }) => {
      executedSql.push(queryConfig.text);
      return { fields: [], rows: [] };
    }) as unknown as typeof fakePool.query;

    const testPrisma = createPrismaClient(testEnv, fakePool);
    await testPrisma.user.findMany();

    expect(executedSql).toHaveLength(1);
    expect(executedSql[0]).toContain('"test"."users"');
    expect(executedSql[0]).not.toContain('"public"');

    // Verify public schema is explicitly rejected in test mode
    expect(() =>
      resolveDatabaseConfig({
        NODE_ENV: "test",
        DATABASE_URL_TEST:
          "postgresql://user:pass@localhost:6543/postgres?schema=public",
      }),
    ).toThrow(/never use the public schema/i);
  });
});
