import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validateApiAuth, hasRequiredRole } from '@/lib/supabase/server'

/**
 * POST /api/admin/run-migration
 * Execute a migration to fix RLS policies
 * Only works in development
 */
export async function POST() {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
  }

  const authResult = await validateApiAuth()
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
  }
  if (!hasRequiredRole(authResult.profile!, ['admin'])) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    // Fix RLS policies
    const sql = `
      -- Drop all existing policies on users table
      DROP POLICY IF EXISTS "Users can view users in their clinic" ON users;
      DROP POLICY IF EXISTS "Users can update users in their clinic" ON users;
      DROP POLICY IF EXISTS "Admins can insert users in their clinic" ON users;
      DROP POLICY IF EXISTS users_select_policy ON users;
      DROP POLICY IF EXISTS users_update_policy ON users;

      -- Create simple, non-recursive policies
      CREATE POLICY "Users can view own record" ON users
          FOR SELECT
          USING (id = auth.uid());

      CREATE POLICY "Users can update own record" ON users
          FOR UPDATE
          USING (id = auth.uid());

      CREATE POLICY "Allow user insertion during signup" ON users
          FOR INSERT
          WITH CHECK (true);

      -- Drop the problematic function if it exists
      DROP FUNCTION IF EXISTS public.get_user_clinic(uuid);

      -- Create a helper function that doesn't cause recursion
      CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
      RETURNS uuid
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $$
          SELECT clinic_id FROM users WHERE id = auth.uid();
      $$;

      GRANT EXECUTE ON FUNCTION public.get_user_clinic_id() TO authenticated;
    `

    const { error } = await (supabaseAdmin as any).rpc('exec_sql' as any, { sql_query: sql } as any)

    if (error) {
      // Try executing via direct query
      console.error('RPC error:', error)

      // Execute statements one by one
      const statements = [
        `DROP POLICY IF EXISTS "Users can view users in their clinic" ON users`,
        `DROP POLICY IF EXISTS "Users can update users in their clinic" ON users`,
        `DROP POLICY IF EXISTS "Admins can insert users in their clinic" ON users`,
        `DROP POLICY IF EXISTS users_select_policy ON users`,
        `DROP POLICY IF EXISTS users_update_policy ON users`,
        `CREATE POLICY "Users can view own record" ON users FOR SELECT USING (id = auth.uid())`,
        `CREATE POLICY "Users can update own record" ON users FOR UPDATE USING (id = auth.uid())`,
        `CREATE POLICY "Allow user insertion during signup" ON users FOR INSERT WITH CHECK (true)`,
      ]

      const results = []
      for (const stmt of statements) {
        try {
          const { error: stmtError } = await (supabaseAdmin as any).rpc('exec' as any, { sql: stmt } as any)
          results.push({ statement: stmt, success: !stmtError, error: stmtError?.message })
        } catch (e) {
          results.push({ statement: stmt, success: false, error: String(e) })
        }
      }

      return NextResponse.json({
        message: 'Attempted to execute statements individually',
        results,
        note: 'You may need to run the migration manually in Supabase Dashboard > SQL Editor',
      })
    }

    return NextResponse.json({ success: true, message: 'Migration executed successfully' })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: 'Failed to execute migration', details: String(error) },
      { status: 500 }
    )
  }
}