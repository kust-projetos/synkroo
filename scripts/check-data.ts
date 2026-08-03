import { config } from 'dotenv'
config({ path: '.env.local' })
config()

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo'

async function main() {
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 5000 })
  try {
    const c = await pool.query('SELECT count(*)::int as cnt FROM clinics')
    console.log('clinicas:', c.rows[0].cnt)
    const p = await pool.query('SELECT count(*)::int as cnt FROM patients')
    console.log('pacientes:', p.rows[0].cnt)
    const u = await pool.query('SELECT count(*)::int as cnt FROM users')
    console.log('usuarios:', u.rows[0].cnt)
    const m = await pool.query("SELECT version FROM __drizzle_migrations ORDER BY version DESC LIMIT 10")
    console.log('migrations:', m.rows.map((r: any) => r.version).join(', '))
  } finally {
    await pool.end()
  }
}
main().catch(e => { console.error(e); process.exit(1) })
