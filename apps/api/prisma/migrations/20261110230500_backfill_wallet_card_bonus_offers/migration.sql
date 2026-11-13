-- Backfill Wallet Card Bonus Offers for existing wallet cards whose catalog cards have a bonus offer
INSERT INTO "wallet_card_bonus_offers" ("id", "wallet_card_id", "spend_requirement_cents", "window_months", "bonus_points", "created_at", "updated_at")
SELECT gen_random_uuid(), wc."id", bo."spend_requirement_cents", bo."window_months", bo."bonus_points", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "wallet_cards" wc
JOIN "bonus_offers" bo ON bo."card_id" = wc."card_id"
ON CONFLICT ("wallet_card_id") DO NOTHING;
