-- ============================================
-- Fix RLS Infinite Recursion on users table
-- ============================================

-- Create a security definer function in public schema to break recursion
CREATE OR REPLACE FUNCTION public.get_current_clinic_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT clinic_id FROM public.users WHERE id = auth.uid();
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS users_select_policy ON users;

-- Create a new policy using the helper function
CREATE POLICY users_select_policy ON users
    FOR SELECT
    USING (
        id = auth.uid()
        OR
        clinic_id = public.get_current_clinic_id()
    );

-- Update other policies to use the helper function
DROP POLICY IF EXISTS users_update_policy ON users;
CREATE POLICY users_update_policy ON users
    FOR UPDATE
    USING (
        id = auth.uid()
        OR
        clinic_id = public.get_current_clinic_id()
    );

-- Grant execute on the helper function
GRANT EXECUTE ON FUNCTION public.get_current_clinic_id() TO authenticated;