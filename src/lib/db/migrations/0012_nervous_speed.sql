ALTER TABLE "crm_duplicate_suggestions"
  ADD CONSTRAINT "crm_duplicate_suggestions_winner_member_check"
  CHECK ("winner_confirmed_id" IS NULL OR "winner_confirmed_id" IN ("left_id", "right_id"));
