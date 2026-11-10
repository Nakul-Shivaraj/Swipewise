-- CreateTable
CREATE TABLE "program_balances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "points_balance" INTEGER NOT NULL,
    "expiry_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "program_balances_user_id_program_id_key" ON "program_balances"("user_id", "program_id");

-- AddForeignKey
ALTER TABLE "program_balances" ADD CONSTRAINT "program_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_balances" ADD CONSTRAINT "program_balances_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "rewards_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
