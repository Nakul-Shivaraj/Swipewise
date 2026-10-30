-- CreateTable
CREATE TABLE IF NOT EXISTS "rate_limits" (
    "key" TEXT NOT NULL,
    "total_hits" INTEGER NOT NULL DEFAULT 1,
    "reset_time" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);
