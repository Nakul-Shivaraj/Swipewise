-- CreateTable
CREATE TABLE "wallet_card_payment_settings" (
    "id" TEXT NOT NULL,
    "wallet_card_id" TEXT NOT NULL,
    "due_day" INTEGER NOT NULL,
    "is_autopay" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_card_payment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_card_paid_cycles" (
    "id" TEXT NOT NULL,
    "wallet_card_id" TEXT NOT NULL,
    "cycle_year_month" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_card_paid_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_card_payment_settings_wallet_card_id_key" ON "wallet_card_payment_settings"("wallet_card_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_card_paid_cycles_wallet_card_id_cycle_year_month_key" ON "wallet_card_paid_cycles"("wallet_card_id", "cycle_year_month");

-- AddForeignKey
ALTER TABLE "wallet_card_payment_settings" ADD CONSTRAINT "wallet_card_payment_settings_wallet_card_id_fkey" FOREIGN KEY ("wallet_card_id") REFERENCES "wallet_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_card_paid_cycles" ADD CONSTRAINT "wallet_card_paid_cycles_wallet_card_id_fkey" FOREIGN KEY ("wallet_card_id") REFERENCES "wallet_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
