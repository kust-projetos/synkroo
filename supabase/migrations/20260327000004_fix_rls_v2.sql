-- ============================================
-- Fix RLS Infinite Recursion - Final Solution
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS users_select_policy ON users;
DROP POLICY IF EXISTS users_update_policy ON users;

-- Create a SECURITY DEFINER function that bypasses RLS
-- This function runs as the function owner (postgres), not the caller
CREATE OR REPLACE FUNCTION public.get_user_clinic(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT clinic_id FROM users WHERE id = p_user_id;
$$;

-- Create policies using the SECURITY DEFINER function
-- No recursion because the function runs with elevated privileges
CREATE POLICY users_select_policy ON users
    FOR SELECT
    USING (
        -- User can always see their own record
        id = auth.uid()
        OR
        -- Can see others in same clinic
        clinic_id = public.get_user_clinic(auth.uid())
    );

CREATE POLICY users_update_policy ON users
    FOR UPDATE
    USING (
        id = auth.uid()
        OR
        clinic_id = public.get_user_clinic(auth.uid())
    );

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_clinic(UUID) TO authenticated;