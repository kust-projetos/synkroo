/**
 * Supabase Connection Test
 * Run with: npx ts-node scripts/test-supabase.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.local if exists
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config()

async function testConnection() {
  console.log('🔍 Testing Supabase connection...\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Check environment variables
  console.log('📋 Checking environment variables:')
  console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`)
  console.log(`   NEXT_PUBLIC_SUPABASE_ANON_KEY: ${anonKey ? '✅ Set' : '❌ Missing'}`)
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? '✅ Set' : '❌ Missing'}\n`)

  if (!supabaseUrl || !anonKey) {
    console.error('❌ Missing required environment variables!')
    console.log('\n📝 Create a .env.local file with:')
    console.log(`
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
    `)
    process.exit(1)
  }

  // Test anon client (RLS protected)
  console.log('🔐 Testing anon client (RLS protected)...')
  const anonClient = createClient(supabaseUrl, anonKey)

  try {
    // This should fail without auth (RLS)
    const { data: clinics, error } = await anonClient.from('clinics').select('id, name')

    if (error) {
      console.log('   ✅ RLS working correctly - anon cannot read without auth')
      console.log(`   Error: ${error.message}`)
    } else {
      console.log(`   ⚠️ Warning: Anon can read ${clinics?.length} clinics (check RLS policies)`)
    }
  } catch (err) {
    console.log(`   ❌ Connection error: ${err}`)
  }

  // Test service client (bypasses RLS)
  if (serviceKey) {
    console.log('\n🔑 Testing service role client (bypasses RLS)...')
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    })

    try {
      // Test clinics table
      const { data: clinics, error: clinicsError } = await adminClient
        .from('clinics')
        .select('id, name, slug')
        .limit(5)

      if (clinicsError) {
        console.log(`   ❌ Error reading clinics: ${clinicsError.message}`)
      } else {
        console.log(`   ✅ Found ${clinics?.length || 0} clinics:`)
        clinics?.forEach(c => console.log(`      - ${c.name} (${c.slug})`))
      }

      // Test patients table
      const { data: patients, error: patientsError } = await adminClient
        .from('patients')
        .select('id, name, phone')
        .limit(5)

      if (patientsError) {
        console.log(`   ❌ Error reading patients: ${patientsError.message}`)
      } else {
        console.log(`   ✅ Found ${patients?.length || 0} patients`)
      }

      // Test functions
      console.log('\n⚡ Testing SQL functions...')
      const { data: insights, error: insightsError } = await adminClient.rpc(
        'get_patient_insights',
        { p_patient_id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }
      )

      if (insightsError) {
        console.log(`   ❌ Error calling function: ${insightsError.message}`)
      } else {
        console.log('   ✅ get_patient_insights function working')
        console.log(`   Sample data: ${JSON.stringify(insights, null, 2).substring(0, 200)}...`)
      }

      // Test knowledge base
      const { data: kb, error: kbError } = await adminClient
        .from('knowledge_base')
        .select('category, question')
        .limit(3)

      if (kbError) {
        console.log(`   ❌ Error reading knowledge base: ${kbError.message}`)
      } else {
        console.log(`   ✅ Knowledge base has ${kb?.length || 0} entries`)
      }

    } catch (err) {
      console.log(`   ❌ Admin client error: ${err}`)
    }
  } else {
    console.log('\n⚠️ Skipping service role tests (SUPABASE_SERVICE_ROLE_KEY not set)')
  }

  console.log('\n✨ Connection test complete!')
}

testConnection().catch(console.error)