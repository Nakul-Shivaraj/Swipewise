import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_CARDS, DEMO_PROGRAMS, DEMO_STORES } from './seed-data.ts';

function escapeSql(val: string): string {
  return val.replace(/'/g, "''");
}

export function buildSeedSql(): string {
  const statements: string[] = [];

  // Rewards Programs
  statements.push('-- Seed Rewards Programs');
  const progValues = DEMO_PROGRAMS.map(
    (p) =>
      `(gen_random_uuid(), '${escapeSql(p.name)}', ${p.centsPer100Points}, NOW(), NOW())`
  ).join(',\n  ');

  statements.push(`
INSERT INTO rewards_programs (id, name, cents_per_100_points, created_at, updated_at)
VALUES
  ${progValues}
ON CONFLICT (name) DO UPDATE
SET cents_per_100_points = EXCLUDED.cents_per_100_points, updated_at = NOW();
`);

  // Cards
  statements.push('-- Seed Cards');
  const cardValues = DEMO_CARDS.map(
    (c) =>
      `(gen_random_uuid(), '${escapeSql(c.name)}', '${escapeSql(c.issuer)}', '${escapeSql(c.artColor)}', ${c.isDemo}, (SELECT id FROM rewards_programs WHERE name = '${escapeSql(c.programName)}'), ${c.annualFeeCents}, ${c.baseRateX100}, false, NOW(), NOW())`
  ).join(',\n  ');

  statements.push(`
INSERT INTO cards (id, name, issuer, art_color, is_demo, program_id, annual_fee_cents, base_rate_x100, is_retired, created_at, updated_at)
VALUES
  ${cardValues}
ON CONFLICT (name) DO UPDATE
SET
  issuer = EXCLUDED.issuer,
  art_color = EXCLUDED.art_color,
  is_demo = EXCLUDED.is_demo,
  program_id = EXCLUDED.program_id,
  annual_fee_cents = EXCLUDED.annual_fee_cents,
  base_rate_x100 = EXCLUDED.base_rate_x100,
  updated_at = NOW();
`);

  // Reward Rules
  statements.push('-- Seed Reward Rules');
  const ruleValues: string[] = [];
  for (const card of DEMO_CARDS) {
    for (const rule of card.rules) {
      const capVal = rule.capCents !== undefined && rule.capCents !== null ? rule.capCents : 'NULL';
      ruleValues.push(
        `(gen_random_uuid(), (SELECT id FROM cards WHERE name = '${escapeSql(card.name)}'), '${rule.category}', ${rule.rateX100}, ${capVal}, NOW(), NOW())`
      );
    }
  }

  if (ruleValues.length > 0) {
    statements.push(`
INSERT INTO reward_rules (id, card_id, category, rate_x100, cap_cents, created_at, updated_at)
VALUES
  ${ruleValues.join(',\n  ')}
ON CONFLICT (card_id, category) DO UPDATE
SET
  rate_x100 = EXCLUDED.rate_x100,
  cap_cents = EXCLUDED.cap_cents,
  updated_at = NOW();
`);
  }

  // Stores
  statements.push('-- Seed Stores');
  const storeValues = DEMO_STORES.map(
    (s) =>
      `(gen_random_uuid(), '${escapeSql(s.name)}', '${s.category}', NOW(), NOW())`
  ).join(',\n  ');

  statements.push(`
INSERT INTO stores (id, name, category, created_at, updated_at)
VALUES
  ${storeValues}
ON CONFLICT (name) DO UPDATE
SET
  category = EXCLUDED.category,
  updated_at = NOW();
`);

  // Store Aliases
  statements.push('-- Seed Store Aliases');
  const aliasValues: string[] = [];
  for (const store of DEMO_STORES) {
    for (const alias of store.aliases) {
      aliasValues.push(
        `(gen_random_uuid(), (SELECT id FROM stores WHERE name = '${escapeSql(store.name)}'), '${escapeSql(alias)}', NOW(), NOW())`
      );
    }
  }

  if (aliasValues.length > 0) {
    statements.push(`
INSERT INTO store_aliases (id, store_id, alias, created_at, updated_at)
VALUES
  ${aliasValues.join(',\n  ')}
ON CONFLICT (store_id, alias) DO NOTHING;
`);
  }

  return statements.join('\n');
}

export async function seed(): Promise<void> {
  console.log('Seeding demo data into Supabase database...');
  const sql = buildSeedSql();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const prismaConfigPath = path.resolve(__dirname, '../prisma.config.ts');

  try {
    execSync(`npx prisma db execute --config "${prismaConfigPath}" --stdin`, {
      input: sql,
      stdio: ['pipe', 'pipe', 'inherit'],
      encoding: 'utf-8',
    });

    console.log('Database seed completed successfully.');
  } catch (err) {
    console.error('Failed to execute seed SQL:', err);
    throw err;
  }
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js'));

if (isDirectRun) {
  seed().catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
}
