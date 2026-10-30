import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Prisma Schema Definition (Issue #9)', () => {
  const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  it('AC: schema defines all 7 required models', () => {
    const requiredModels = [
      'User',
      'RewardsProgram',
      'Card',
      'RewardRule',
      'Store',
      'StoreAlias',
      'WalletCard',
    ];

    for (const model of requiredModels) {
      expect(schema).toMatch(new RegExp(`model\\s+${model}\\s+{`));
    }
  });

  it('AC: schema defines Category enum with GROCERIES, DINING, GAS, TRAVEL', () => {
    expect(schema).toMatch(/enum\s+Category\s+{/);
    const enumBlock = schema.split(/enum\s+Category\s+{/)[1]?.split('}')[0] || '';
    expect(enumBlock).toContain('GROCERIES');
    expect(enumBlock).toContain('DINING');
    expect(enumBlock).toContain('GAS');
    expect(enumBlock).toContain('TRAVEL');
  });

  it('AC: models use snake_case database tables via @@map', () => {
    expect(schema).toContain('@@map("users")');
    expect(schema).toContain('@@map("rewards_programs")');
    expect(schema).toContain('@@map("cards")');
    expect(schema).toContain('@@map("reward_rules")');
    expect(schema).toContain('@@map("stores")');
    expect(schema).toContain('@@map("store_aliases")');
    expect(schema).toContain('@@map("wallet_cards")');
  });

  it('AC: money fields end with Cents and rate fields use rateX100 / centsPer100Points', () => {
    expect(schema).toContain('annualFeeCents');
    expect(schema).toContain('centsPer100Points');
    expect(schema).toContain('baseRateX100');
    expect(schema).toContain('rateX100');
    expect(schema).toContain('capCents');
  });

  it('AC: calendar date fields use @db.Date and suffix Date', () => {
    expect(schema).toMatch(/openedDate\s+DateTime\?\s+@db\.Date/);
  });
});
