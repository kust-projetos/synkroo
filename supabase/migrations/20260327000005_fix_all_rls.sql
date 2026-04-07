-- ============================================
-- Fix ALL RLS Recursive Policies
-- ============================================

-- ============================================
-- Step 1: Drop ALL problematic policies on users table
-- ============================================
DROP POLICY IF EXISTS "Users can view users in their clinic" ON users;
DROP POLICY IF EXISTS "Users can update users in their clinic" ON users;
DROP POLICY IF EXISTS "Admins can insert users in their clinic" ON users;
DROP POLICY IF EXISTS users_select_policy ON users;
DROP POLICY IF EXISTS users_update_policy ON users;

-- ============================================
-- Step 2: Create helper function with SECURITY DEFINER
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_clinic(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT clinic_id FROM users WHERE id = p_user_id;
$$;

-- ============================================
-- Step 3: Recreate users policies without recursion
-- ============================================
CREATE POLICY "Users can view users in their clinic" ON users
    FOR SELECT
    USING (
        id = auth.uid()
        OR
        clinic_id = public.get_user_clinic(auth.uid())
    );

CREATE POLICY "Users can update users in their clinic" ON users
    FOR UPDATE
    USING (
        id = auth.uid()
        OR
        (clinic_id = public.get_user_clinic(auth.uid())
         AND public.get_user_clinic(auth.uid()) IN (
             SELECT clinic_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
         ))
    );

CREATE POLICY "Admins can insert users in their clinic" ON users
    FOR INSERT
    WITH CHECK (
        clinic_id = public.get_user_clinic(auth.uid())
        AND EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- ============================================
-- Step 4: Fix policies on other tables that query users
-- ============================================

-- Drop old policies on clinics
DROP POLICY IF EXISTS "Users can view their own clinic" ON clinics;
DROP POLICY IF EXISTS "Users can update their own clinic" ON clinics;

-- Recreate with helper function
CREATE POLICY "Users can view their own clinic" ON clinics
    FOR SELECT
    USING (id = public.get_user_clinic(auth.uid()));

CREATE POLICY "Users can update their own clinic" ON clinics
    FOR UPDATE
    USING (id = public.get_user_clinic(auth.uid()));

-- Drop old policies on patients
DROP POLICY IF EXISTS "Users can view patients in their clinic" ON patients;
DROP POLICY IF EXISTS "Users can insert patients in their clinic" ON patients;
DROP POLICY IF EXISTS "Users can update patients in their clinic" ON patients;

-- Recreate with helper function
CREATE POLICY "Users can view patients in their clinic" ON patients
    FOR SELECT
    USING (clinic_id = public.get_user_clinic(auth.uid()));

CREATE POLICY "Users can insert patients in their clinic" ON patients
    FOR INSERT
    WITH CHECK (clinic_id = public.get_user_clinic(auth.uid()));

CREATE POLICY "Users can update patients in their clinic" ON patients
    FOR UPDATE
    USING (clinic_id = public.get_user_clinic(auth.uid()));

-- Drop old policies on dentists
DROP POLICY IF EXISTS "Users can view dentists in their clinic" ON dentists;
DROP POLICY IF EXISTS "Users can insert dentists in their clinic" ON dentists;
DROP POLICY IF EXISTS "Users can update dentists in their clinic" ON dentists;

-- Recreate with helper function (if these policies exist)
CREATE POLICY "Users can view dentists in their clinic" ON dentists
    FOR SELECT
    USING (clinic_id = public.get_user_clinic(auth.uid()));

CREATE POLICY "Users can insert dentists in their clinic" ON dentists
    FOR INSERT
    WITH CHECK (clinic_id = public.get_user_clinic(auth.uid()));

CREATE POLICY "Users can update dentists in their clinic" ON dentists
    FOR UPDATE
    USING (clinic_id = public.get_user_clinic(auth.uid()));

-- ============================================
-- Step 5: Grant execute to authenticated users
-- ============================================
GRANT EXECUTE ON FUNCTION public.get_user_clinic(UUID) TO authenticated;