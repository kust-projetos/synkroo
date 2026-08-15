DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users
    GROUP BY clinic_id, email
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'users duplicate clinic/email keys require preflight cleanup';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "users_clinic_email_uniq" ON "users" USING btree ("clinic_id","email");