import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Prisma Schema Definition (Issue #9)", () => {
  const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  it("AC: schema defines all 7 required models", () => {
    const requiredModels = [
      "User",
      "RewardsProgram",
      "Card",
      "RewardRule",
      "Store",
      "StoreAlias",
      "WalletCard",
    ];

    for (const model of requiredModels) {
      expect(schema).toMatch(new RegExp(`model\\s+${model}\\s+{`));
    }
  });

  it("AC: schema defines Category enum with GROCERIES, DINING, GAS, TRAVEL", () => {
    expect(schema).toMatch(/enum\s+Category\s+{/);
    const enumBlock =
      schema.split(/enum\s+Category\s+{/)[1]?.split("}")[0] || "";
    expect(enumBlock).toContain("GROCERIES");
    expect(enumBlock).toContain("DINING");
    expect(enumBlock).toContain("GAS");
    expect(enumBlock).toContain("TRAVEL");
  });

  it("AC: models use snake_case database tables via @@map", () => {
    expect(schema).toContain('@@map("users")');
    expect(schema).toContain('@@map("rewards_programs")');
    expect(schema).toContain('@@map("cards")');
    expect(schema).toContain('@@map("reward_rules")');
    expect(schema).toContain('@@map("stores")');
    expect(schema).toContain('@@map("store_aliases")');
    expect(schema).toContain('@@map("wallet_cards")');
    expect(schema).toContain('@@map("bonus_offers")');
    expect(schema).toContain('@@map("wallet_card_bonus_offers")');
    expect(schema).toContain('@@map("spend_entries")');
  });

  it("AC: money fields end with Cents and rate fields use rateX100 / centsPer100Points", () => {
    expect(schema).toContain("annualFeeCents");
    expect(schema).toContain("centsPer100Points");
    expect(schema).toContain("baseRateX100");
    expect(schema).toContain("rateX100");
    expect(schema).toContain("capCents");
  });

  it("AC: calendar date fields use @db.Date and suffix Date", () => {
    expect(schema).toMatch(/openedDate\s+DateTime\?\s+@db\.Date/);
  });

  it("AC: Card model defines issuer, artColor, and isDemo fields", () => {
    expect(schema).toMatch(/issuer\s+String/);
    expect(schema).toMatch(/artColor\s+String\s+@map\("art_color"\)/);
    expect(schema).toMatch(
      /isDemo\s+Boolean\s+@default\(true\)\s+@map\("is_demo"\)/,
    );
  });

  it("Issue #19: schema defines ReminderType, Notification, and NotificationPreference", () => {
    expect(schema).toMatch(/enum\s+ReminderType\s+{/);
    const reminderEnumBlock =
      schema.split(/enum\s+ReminderType\s+{/)[1]?.split("}")[0] || "";
    expect(reminderEnumBlock).toContain("PAYMENT_DUE");
    expect(reminderEnumBlock).toContain("PERK_ENDING");
    expect(reminderEnumBlock).toContain("ROTATING_CATEGORY");
    expect(reminderEnumBlock).toContain("POINTS_EXPIRY");

    expect(schema).toMatch(/model\s+Notification\s+{/);
    expect(schema).toMatch(
      /dedupeKey\s+String\s+@unique\s+@map\("dedupe_key"\)/,
    );
    expect(schema).toMatch(
      /dueDate\s+DateTime\s+@db\.Date\s+@map\("due_date"\)/,
    );
    expect(schema).toMatch(/dismissedAt\s+DateTime\?\s+@map\("dismissed_at"\)/);
    expect(schema).toContain('@@map("notifications")');

    expect(schema).toMatch(/model\s+NotificationPreference\s+{/);
    expect(schema).toContain("@@unique([userId, type])");
    expect(schema).toContain('@@map("notification_preferences")');
  });

  it("Issue #20: schema defines WalletCardPaymentSetting and WalletCardPaidCycle linked to WalletCard", () => {
    expect(schema).toMatch(/model\s+WalletCardPaymentSetting\s+{/);
    expect(schema).toMatch(/dueDay\s+Int\s+@map\("due_day"\)/);
    expect(schema).toMatch(
      /isAutopay\s+Boolean\s+@default\(false\)\s+@map\("is_autopay"\)/,
    );
    expect(schema).toContain('@@map("wallet_card_payment_settings")');

    expect(schema).toMatch(/model\s+WalletCardPaidCycle\s+{/);
    expect(schema).toMatch(
      /cycleYearMonth\s+String\s+@map\("cycle_year_month"\)/,
    );
    expect(schema).toContain("@@unique([walletCardId, cycleYearMonth])");
    expect(schema).toContain('@@map("wallet_card_paid_cycles")');
  });

  it("Issue #24: schema defines ProgramBalance with unique [userId, programId] and @db.Date expiryDate", () => {
    expect(schema).toMatch(/model\s+ProgramBalance\s+{/);
    expect(schema).toMatch(/pointsBalance\s+Int\s+@map\("points_balance"\)/);
    expect(schema).toMatch(
      /expiryDate\s+DateTime\s+@db\.Date\s+@map\("expiry_date"\)/,
    );
    expect(schema).toContain("@@unique([userId, programId])");
    expect(schema).toContain('@@map("program_balances")');
  });
  it("Issue #21: schema defines PerkPeriod, Perk, and PerkUsage models", () => {
    expect(schema).toMatch(/enum\s+PerkPeriod\s+{/);
    const perkPeriodEnumBlock =
      schema.split(/enum\s+PerkPeriod\s+{/)[1]?.split("}")[0] || "";
    expect(perkPeriodEnumBlock).toContain("MONTHLY");
    expect(perkPeriodEnumBlock).toContain("QUARTERLY");
    expect(perkPeriodEnumBlock).toContain("SEMIANNUAL");
    expect(perkPeriodEnumBlock).toContain("ANNUAL");

    expect(schema).toMatch(/model\s+Perk\s+{/);
    expect(schema).toMatch(/amountCents\s+Int\s+@map\("amount_cents"\)/);
    expect(schema).toContain('@@map("perks")');

    expect(schema).toMatch(/model\s+PerkUsage\s+{/);
    expect(schema).toMatch(
      /usedCents\s+Int\s+@default\(0\)\s+@map\("used_cents"\)/,
    );
    expect(schema).toMatch(/periodKey\s+String\s+@map\("period_key"\)/);
    expect(schema).toContain("@@unique([walletCardId, perkId, periodKey])");
    expect(schema).toContain('@@map("perk_usages")');
  });

  it("Issue #23: schema defines RotatingCategory and WalletCardQuarterActivation", () => {
    expect(schema).toMatch(/model\s+RotatingCategory\s+{/);
    expect(schema).toContain("@@unique([cardId, quarter, category])");
    expect(schema).toContain('@@map("rotating_categories")');

    expect(schema).toMatch(/model\s+WalletCardQuarterActivation\s+{/);
    expect(schema).toContain("@@unique([walletCardId, quarter])");
    expect(schema).toContain('@@map("wallet_card_quarter_activations")');
  });
});
