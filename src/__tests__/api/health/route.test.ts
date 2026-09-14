/** Tests for health routes — liveness puro + ledger de migrations (F2) */
import * as fs from 'node:fs'
import * as path from 'node:path'

const mdb = {
  execute: jest.fn().mockResolvedValue({ rows: [{ count: 30 }] }),
} as any
jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mdb) }))

import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db/client'
import { GET } from '../../../app/api/health/route'
import { GET as GET_DB } from '../../../app/api/health/db/route'
import { EXPECTED_MIGRATIONS } from '@/services/api-handlers/health/db'

const mockGetDb = getDb as jest.Mock
const DRIVER_MARKER = 'DRIVER_SECRET_MARKER_9f8b'

beforeEach(() => {
  jest.clearAllMocks()
  mdb.execute.mockResolvedValue({ rows: [{ count: 30 }] })
  mockGetDb.mockReturnValue(mdb)
})

describe('health (liveness puro)', () => {
  it('retorna ok sem tocar no banco', async () => {
    const r = await GET(new NextRequest('http://localhost'))
    const b = await r.json()
    expect(r.status).toBe(200)
    expect(b.status).toBe('ok')
    expect(b).toHaveProperty('timestamp')
    expect(b.version).toBe('1.0.0')
    expect(mockGetDb).not.toHaveBeenCalled()
  })

  it('ainda retorna 200 mesmo se o db client lançar', async () => {
    mockGetDb.mockImplementation(() => {
      throw new Error(DRIVER_MARKER)
    })
    const r = await GET(new NextRequest('http://localhost'))
    const b = await r.json()
    expect(r.status).toBe(200)
    expect(b.status).toBe('ok')
    expect(JSON.stringify(b)).not.toContain(DRIVER_MARKER)
  })

  it('payload mínimo: sem checks/latency de DB', async () => {
    const b = await (await GET(new NextRequest('http://localhost'))).json()
    expect(b).not.toHaveProperty('checks')
    expect(b).not.toHaveProperty('latency')
  })
})

describe('health/db (ledger de migrations, sanitizado)', () => {
  it('EXPECTED_MIGRATIONS sincronizado com meta/_journal.json', () => {
    const journalPath = path.join(__dirname, '../../../lib/db/migrations/meta/_journal.json')
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as { entries: unknown[] }
    expect(EXPECTED_MIGRATIONS).toBe(journal.entries.length)
  })

  it('complete quando ledger aplicado >= esperado', async () => {
    const r = await GET_DB(new NextRequest('http://localhost'))
    const b = await r.json()
    expect(r.status).toBe(200)
    expect(b.status).toBe('complete')
    expect(b.complete).toBe(true)
    expect(b.migrations_applied).toBe(30)
    expect(b.migrations_expected).toBe(EXPECTED_MIGRATIONS)
    expect(b).not.toHaveProperty('tables')
  })

  it('incomplete quando ledger aplicado < esperado, sem error.message', async () => {
    mdb.execute.mockResolvedValue({ rows: [{ count: 12 }] })
    const r = await GET_DB(new NextRequest('http://localhost'))
    const b = await r.json()
    expect(r.status).toBe(200)
    expect(b.status).toBe('incomplete')
    expect(b.complete).toBe(false)
    expect(b.migrations_applied).toBe(12)
    expect(JSON.stringify(b)).not.toContain(DRIVER_MARKER)
  })

  it('getDb() lançando (DATABASE_URL ausente) → sanitizado, 200, sem marker', async () => {
    mockGetDb.mockImplementation(() => {
      throw new Error(`${DRIVER_MARKER} No database connection available`)
    })
    const r = await GET_DB(new NextRequest('http://localhost'))
    const b = await r.json()
    expect(r.status).toBe(200)
    expect(b.status).toBe('incomplete')
    expect(b.complete).toBe(false)
    expect(b.migrations_applied).toBe(0)
    expect(b.migrations_expected).toBe(EXPECTED_MIGRATIONS)
    expect(JSON.stringify(b)).not.toContain(DRIVER_MARKER)
  })

  it('falha na query do ledger → sanitizado, sem vazar driver', async () => {
    mdb.execute.mockRejectedValue(new Error(`${DRIVER_MARKER} connection refused`))
    const r = await GET_DB(new NextRequest('http://localhost'))
    const b = await r.json()
    expect(r.status).toBe(200)
    expect(b.status).toBe('incomplete')
    expect(JSON.stringify(b)).not.toContain(DRIVER_MARKER)
  })
})
