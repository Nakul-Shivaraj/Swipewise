-- CreateTable
CREATE TABLE "rotating_categories" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "rate_x100" INTEGER NOT NULL,
    "cap_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rotating_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_card_quarter_activations" (
    "id" TEXT NOT NULL,
    "wallet_card_id" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_card_quarter_activations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rotating_categories_card_id_quarter_category_key" ON "rotating_categories"("card_id", "quarter", "category");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_card_quarter_activations_wallet_card_id_quarter_key" ON "wallet_card_quarter_activations"("wallet_card_id", "quarter");

-- AddForeignKey
ALTER TABLE "rotating_categories" ADD CONSTRAINT "rotating_categories_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_card_quarter_activations" ADD CONSTRAINT "wallet_card_quarter_activations_wallet_card_id_fkey" FOREIGN KEY ("wallet_card_id") REFERENCES "wallet_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
