-- W6.1: detect duplicates before creating unique index; abort and generate report if any
DO $$
DECLARE dup_count int;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT clinic_id, channel, external_id, COUNT(*) FROM conversations GROUP BY clinic_id, channel, external_id HAVING COUNT(*) > 1
  ) s;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'W6.1 audit failed: % duplicate (clinic_id, channel, external_id) groups found — manual merge required, not auto-merge', dup_count;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_clinic_channel_external_unique" ON "conversations" USING btree ("clinic_id","channel","external_id");