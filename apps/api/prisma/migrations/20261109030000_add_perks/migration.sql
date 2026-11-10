-- CreateEnum
CREATE TYPE "PerkPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateTable
CREATE TABLE "perks" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "period" "PerkPeriod" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perk_usages" (
    "id" TEXT NOT NULL,
    "wallet_card_id" TEXT NOT NULL,
    "perk_id" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "used_cents" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perk_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "perk_usages_wallet_card_id_perk_id_period_key_key" ON "perk_usages"("wallet_card_id", "perk_id", "period_key");

-- AddForeignKey
ALTER TABLE "perks" ADD CONSTRAINT "perks_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perk_usages" ADD CONSTRAINT "perk_usages_wallet_card_id_fkey" FOREIGN KEY ("wallet_card_id") REFERENCES "wallet_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perk_usages" ADD CONSTRAINT "perk_usages_perk_id_fkey" FOREIGN KEY ("perk_id") REFERENCES "perks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
