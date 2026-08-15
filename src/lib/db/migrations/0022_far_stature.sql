DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users
    GROUP BY clinic_id, lower(btrim(email))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'users duplicate normalized clinic/email keys require preflight cleanup';
  END IF;
END $$;--> statement-breakpoint
UPDATE users
SET email = lower(btrim(email))
WHERE email <> lower(btrim(email));--> statement-breakpoint
DROP INDEX "users_clinic_email_uniq";--> statement-breakpoint
CREATE UNIQUE INDEX "users_clinic_email_uniq" ON "users" USING btree ("clinic_id",lower(btrim("email")));