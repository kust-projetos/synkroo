-- ============================================
-- Consolidate RLS Helper Functions
-- Drop get_current_clinic_id (from migration 003), keep get_user_clinic_id (from migration 006) as canonical
-- Date: 2026-04-24
-- ============================================

-- Drop the deprecated helper function from migration 003
DROP FUNCTION IF EXISTS public.get_current_clinic_id();

-- Ensure the canonical helper function exists (created in migration 006)
-- Using CREATE OR REPLACE to ensure it's present even if migration 006 was modified
CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT clinic_id FROM users WHERE id = auth.uid();
$$;

-- Grant execute permission (idempotent)
GRANT EXECUTE ON FUNCTION public.get_user_clinic_id() TO authenticated;

-- Update any RLS policies that still reference get_current_clinic_id()
-- Migration 003 created these policies on the users table using get_current_clinic_id
-- These were already replaced by migration 006, but we ensure they're cleaned up

-- Drop and recreate users policies that may still reference the old function
DROP POLICY IF EXISTS users_select_policy ON users;
DROP POLICY IF EXISTS users_update_policy ON users;

-- Verify users table has correct policies using get_user_clinic_id
-- Only create if they don't already exist (from migration 006)
DO $$
BEGIN
    -- Create select policy if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'users' AND policyname = 'users_select_clinic_policy'
    ) THEN
        CREATE POLICY users_select_clinic_policy ON users
            FOR SELECT
            USING (
                id = auth.uid()
                OR
                clinic_id = public.get_user_clinic_id()
            );
    END IF;

    -- Create update policy if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'users' AND policyname = 'users_update_clinic_policy'
    ) THEN
        CREATE POLICY users_update_clinic_policy ON users
            FOR UPDATE
            USING (
                id = auth.uid()
                OR
                clinic_id = public.get_user_clinic_id()
            );
    END IF;
END $$;
