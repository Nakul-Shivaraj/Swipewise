import { describe, expect, it } from 'vitest';
import { DEMO_CARDS, DEMO_PROGRAMS, DEMO_STORES } from './seed-data.ts';
import { buildSeedSql } from './seed.ts';

describe('Demo Seed Data (Issue #9)', () => {
  it('AC: defines rewards programs with integer centsPer100Points', () => {
    expect(DEMO_PROGRAMS.length).toBeGreaterThanOrEqual(2);
    for (const program of DEMO_PROGRAMS) {
      expect(typeof program.name).toBe('string');
      expect(Number.isInteger(program.centsPer100Points)).toBe(true);
      expect(program.centsPer100Points).toBeGreaterThan(0);
    }

    const cashBack = DEMO_PROGRAMS.find((p) => p.name === 'Cash Back');
    expect(cashBack).toBeDefined();
    expect(cashBack?.centsPer100Points).toBe(100);

    const harbor = DEMO_PROGRAMS.find((p) => p.name === 'Harbor Points');
    expect(harbor).toBeDefined();
    expect(harbor?.centsPer100Points).toBe(125); // 1.25¢ per point
  });

  it('AC: defines Mint Everyday demo card with correct fee and rates', () => {
    const mint = DEMO_CARDS.find((c) => c.name === 'Mint Everyday');
    expect(mint).toBeDefined();
    expect(mint?.annualFeeCents).toBe(0);
    expect(mint?.baseRateX100).toBe(100); // 1% base
    expect(mint?.programName).toBe('Cash Back');

    const groceriesRule = mint?.rules.find((r) => r.category === 'GROCERIES');
    expect(groceriesRule).toBeDefined();
    expect(groceriesRule?.rateX100).toBe(400); // 4%

    const diningRule = mint?.rules.find((r) => r.category === 'DINING');
    expect(diningRule).toBeDefined();
    expect(diningRule?.rateX100).toBe(200); // 2%
  });

  it('AC: defines Harbor Travel Plus demo card with $95 fee and 2x travel', () => {
    const harbor = DEMO_CARDS.find((c) => c.name === 'Harbor Travel Plus');
    expect(harbor).toBeDefined();
    expect(harbor?.annualFeeCents).toBe(9500); // $95 fee
    expect(harbor?.baseRateX100).toBe(100); // 1x base
    expect(harbor?.programName).toBe('Harbor Points');

    const travelRule = harbor?.rules.find((r) => r.category === 'TRAVEL');
    expect(travelRule).toBeDefined();
    expect(travelRule?.rateX100).toBe(200); // 2x
  });

  it('AC: defines Basic Flat demo card with 1.5% base and $0 fee', () => {
    const flat = DEMO_CARDS.find((c) => c.name === 'Basic Flat');
    expect(flat).toBeDefined();
    expect(flat?.annualFeeCents).toBe(0);
    expect(flat?.baseRateX100).toBe(150); // 1.5% base
    expect(flat?.programName).toBe('Cash Back');
    expect(flat?.rules.length).toBe(0);
  });

  it('AC: all money and rate values are whole integers (no floats)', () => {
    for (const card of DEMO_CARDS) {
      expect(Number.isInteger(card.annualFeeCents)).toBe(true);
      expect(card.annualFeeCents).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(card.baseRateX100)).toBe(true);
      expect(card.baseRateX100).toBeGreaterThan(0);

      for (const rule of card.rules) {
        expect(Number.isInteger(rule.rateX100)).toBe(true);
        expect(rule.rateX100).toBeGreaterThan(0);
        if (rule.capCents !== undefined && rule.capCents !== null) {
          expect(Number.isInteger(rule.capCents)).toBe(true);
          expect(rule.capCents).toBeGreaterThan(0);
        }
      }
    }
  });

  it('AC: demo cards use made-up names only (AGENTS.md section 12)', () => {
    const forbiddenKeywords = ['chase', 'sapphire', 'amex', 'american express', 'citi', 'capital one', 'discover'];
    for (const card of DEMO_CARDS) {
      const lower = card.name.toLowerCase();
      for (const kw of forbiddenKeywords) {
        expect(lower).not.toContain(kw);
      }
    }
  });

  it('AC: defines required demo stores across categories with aliases', () => {
    const expectedStores = [
      { name: 'Safeway', category: 'GROCERIES' },
      { name: 'Trader Joe’s', category: 'GROCERIES' },
      { name: 'Chipotle', category: 'DINING' },
      { name: 'Shell', category: 'GAS' },
      { name: 'United Airlines', category: 'TRAVEL' },
    ];

    for (const expected of expectedStores) {
      const store = DEMO_STORES.find(
        (s) => s.name === expected.name || s.name.replace('’', "'") === expected.name.replace('’', "'")
      );
      expect(store, `Store ${expected.name} should exist`).toBeDefined();
      expect(store?.category).toBe(expected.category);
    }

    // Trader Joe's should have aliases
    const tj = DEMO_STORES.find((s) => s.name.includes('Trader Joe'));
    expect(tj?.aliases.length).toBeGreaterThanOrEqual(1);

    // United Airlines should have aliases
    const united = DEMO_STORES.find((s) => s.name === 'United Airlines');
    expect(united?.aliases.length).toBeGreaterThanOrEqual(1);
  });

  it('AC: buildSeedSql produces valid idempotent SQL statements without a database', () => {
    const sql = buildSeedSql();
    expect(sql).toContain('INSERT INTO rewards_programs');
    expect(sql).toContain('ON CONFLICT (name) DO UPDATE');
    expect(sql).toContain('INSERT INTO cards');
    expect(sql).toContain('INSERT INTO reward_rules');
    expect(sql).toContain('INSERT INTO stores');
    expect(sql).toContain('INSERT INTO store_aliases');
    expect(sql).toContain('Mint Everyday');
    expect(sql).toContain('Harbor Travel Plus');
    expect(sql).toContain('Basic Flat');
    expect(sql).toContain('Safeway');
    expect(sql).toContain('Trader Joe’s');
    expect(sql).toContain('Chipotle');
    expect(sql).toContain('Shell');
    expect(sql).toContain('United Airlines');
  });
});
