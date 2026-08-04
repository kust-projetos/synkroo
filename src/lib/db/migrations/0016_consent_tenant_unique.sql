DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM consents
    GROUP BY clinic_id, contact_id, contact_type, purpose
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'consents duplicate tenant keys require preflight cleanup';
  END IF;
END $$;

DROP INDEX IF EXISTS "consents_contact_purpose_uniq";
CREATE UNIQUE INDEX IF NOT EXISTS "consents_clinic_contact_purpose_uniq"
  ON "consents" ("clinic_id", "contact_id", "contact_type", "purpose");
