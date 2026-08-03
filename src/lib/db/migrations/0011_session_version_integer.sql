ALTER TABLE "users"
  ALTER COLUMN "session_version" DROP DEFAULT,
  ALTER COLUMN "session_version" TYPE integer
  USING CASE WHEN "session_version" THEN 1 ELSE 0 END;
--> statement-breakpoint
ALTER TABLE "users"
  ALTER COLUMN "session_version" SET DEFAULT 0;
