import pg from "pg";

export function assertLocalDatabaseUrl(
  databaseUrl: string | undefined,
): string {
  if (!databaseUrl) {
    throw new Error("Refusing to reset rate_limits: DATABASE_URL is not set.");
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(
      "Refusing to reset rate_limits: DATABASE_URL is not a valid URL.",
    );
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(
      `Refusing to reset rate_limits: DATABASE_URL host "${parsed.hostname}" is not localhost or 127.0.0.1.`,
    );
  }

  return databaseUrl;
}

export async function clearRateLimits(
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): Promise<void> {
  const safeUrl = assertLocalDatabaseUrl(databaseUrl);
  const parsed = new URL(safeUrl);
  const schema = parsed.searchParams.get("schema") || "public";

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
    throw new Error(
      `Refusing to reset rate_limits: invalid schema name "${schema}".`,
    );
  }

  const client = new pg.Client({ connectionString: safeUrl });
  await client.connect();
  try {
    await client.query(`DELETE FROM "${schema}"."rate_limits"`);
  } finally {
    await client.end();
  }
}
