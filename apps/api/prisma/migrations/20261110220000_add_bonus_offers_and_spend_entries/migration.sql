-- CreateTable
CREATE TABLE "bonus_offers" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "spend_requirement_cents" INTEGER NOT NULL,
    "window_months" INTEGER NOT NULL,
    "bonus_points" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonus_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_card_bonus_offers" (
    "id" TEXT NOT NULL,
    "wallet_card_id" TEXT NOT NULL,
    "spend_requirement_cents" INTEGER NOT NULL,
    "window_months" INTEGER NOT NULL,
    "bonus_points" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_card_bonus_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spend_entries" (
    "id" TEXT NOT NULL,
    "wallet_card_id" TEXT NOT NULL,
    "wallet_card_bonus_offer_id" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spend_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bonus_offers_card_id_key" ON "bonus_offers"("card_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_card_bonus_offers_wallet_card_id_key" ON "wallet_card_bonus_offers"("wallet_card_id");

-- AddForeignKey
ALTER TABLE "bonus_offers" ADD CONSTRAINT "bonus_offers_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_card_bonus_offers" ADD CONSTRAINT "wallet_card_bonus_offers_wallet_card_id_fkey" FOREIGN KEY ("wallet_card_id") REFERENCES "wallet_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spend_entries" ADD CONSTRAINT "spend_entries_wallet_card_id_fkey" FOREIGN KEY ("wallet_card_id") REFERENCES "wallet_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spend_entries" ADD CONSTRAINT "spend_entries_wallet_card_bonus_offer_id_fkey" FOREIGN KEY ("wallet_card_bonus_offer_id") REFERENCES "wallet_card_bonus_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
