-- Add missing columns to waitlist table
-- Required for waitlist service functionality

ALTER TABLE waitlist
ADD COLUMN IF NOT EXISTS procedure_id UUID REFERENCES procedures(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scheduled_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL;

-- Add indexes for waitlist lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_clinic_status ON waitlist(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_date_status ON waitlist(preferred_date, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_patient ON waitlist(patient_id);

-- Update RLS policies for waitlist
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see waitlist entries from their clinic
CREATE POLICY "Users can view clinic waitlist" ON waitlist
    FOR SELECT
    USING (
        clinic_id IN (
            SELECT clinic_id FROM users WHERE id = auth.uid()
        )
    );

-- Policy: Only admins/receptionists can insert
CREATE POLICY "Staff can insert waitlist" ON waitlist
    FOR INSERT
    WITH CHECK (
        clinic_id IN (
            SELECT clinic_id FROM users
            WHERE id = auth.uid()
            AND role IN ('admin', 'receptionist', 'dentist')
        )
    );

-- Policy: Staff can update waitlist
CREATE POLICY "Staff can update waitlist" ON waitlist
    FOR UPDATE
    USING (
        clinic_id IN (
            SELECT clinic_id FROM users
            WHERE id = auth.uid()
            AND role IN ('admin', 'receptionist', 'dentist')
        )
    );

-- Policy: Admins can delete waitlist
CREATE POLICY "Admins can delete waitlist" ON waitlist
    FOR DELETE
    USING (
        clinic_id IN (
            SELECT clinic_id FROM users
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );