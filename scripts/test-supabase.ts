// @ts-nocheck
/**
 * Supabase Connection Test (deprecated — kept for reference)
 * Run with: npx tsx scripts/test-supabase.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

console.log('Supabase test script is deprecated. Run npm run db:health instead.')
process.exit(0)
