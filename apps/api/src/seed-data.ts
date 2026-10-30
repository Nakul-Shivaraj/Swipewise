export type SeedCategory = 'GROCERIES' | 'DINING' | 'GAS' | 'TRAVEL';

export interface SeedRewardsProgram {
  name: string;
  centsPer100Points: number;
}

export interface SeedRewardRule {
  category: SeedCategory;
  rateX100: number;
  capCents?: number;
}

export interface SeedCard {
  name: string;
  issuer: string;
  artColor: string;
  isDemo: boolean;
  programName: string;
  annualFeeCents: number;
  baseRateX100: number;
  rules: SeedRewardRule[];
}

export interface SeedStore {
  name: string;
  category: SeedCategory;
  aliases: string[];
}

export const DEMO_PROGRAMS: SeedRewardsProgram[] = [
  {
    name: 'Cash Back',
    centsPer100Points: 100, // 1¢ per point
  },
  {
    name: 'Harbor Points',
    centsPer100Points: 125, // 1.25¢ per point
  },
];

export const DEMO_CARDS: SeedCard[] = [
  {
    name: 'Mint Everyday',
    issuer: 'Demo Bank',
    artColor: '#2F8C55',
    isDemo: true,
    programName: 'Cash Back',
    annualFeeCents: 0,
    baseRateX100: 100, // 1% base
    rules: [
      {
        category: 'GROCERIES',
        rateX100: 400, // 4% groceries
      },
      {
        category: 'DINING',
        rateX100: 200, // 2% dining
      },
    ],
  },
  {
    name: 'Harbor Travel Plus',
    issuer: 'Demo Bank',
    artColor: '#2F74D0',
    isDemo: true,
    programName: 'Harbor Points',
    annualFeeCents: 9500, // $95 annual fee
    baseRateX100: 100, // 1x base
    rules: [
      {
        category: 'TRAVEL',
        rateX100: 200, // 2x travel
      },
    ],
  },
  {
    name: 'Basic Flat',
    issuer: 'Demo Bank',
    artColor: '#958C7B',
    isDemo: true,
    programName: 'Cash Back',
    annualFeeCents: 0, // $0 fee
    baseRateX100: 150, // 1.5% base
    rules: [],
  },
];

export const DEMO_STORES: SeedStore[] = [
  {
    name: 'Safeway',
    category: 'GROCERIES',
    aliases: ['Safeway Grocery'],
  },
  {
    name: 'Trader Joe’s',
    category: 'GROCERIES',
    aliases: ['Trader Joes', "TJ's", 'TJs'],
  },
  {
    name: 'Chipotle',
    category: 'DINING',
    aliases: ['Chipotle Mexican Grill'],
  },
  {
    name: 'Shell',
    category: 'GAS',
    aliases: ['Shell Oil', 'Shell Gas Station'],
  },
  {
    name: 'United Airlines',
    category: 'TRAVEL',
    aliases: ['United', 'United Air'],
  },
];
