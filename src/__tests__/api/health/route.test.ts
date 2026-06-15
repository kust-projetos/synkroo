/** Tests for health routes — Drizzle mocks */
const mdb = {
  execute: jest.fn().mockResolvedValue({ rows: [{ count: 1 }] }),
} as any
jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mdb) }))

import { NextRequest } from 'next/server'
import { GET } from '../../../app/api/health/route'
import { GET as GET_DB } from '../../../app/api/health/db/route'

beforeEach(() => { jest.clearAllMocks(); mdb.execute.mockResolvedValue({ rows: [{ count: 1 }] }) })

describe('health', () => {
  it('returns healthy when DB ok', async () => {
    mdb.execute.mockResolvedValue({})
    const r = await GET(new NextRequest('http://localhost'))
    const b = await r.json()
    expect(b.status).toBe('healthy')
    expect(b.checks.database.status).toBe('ok')
  })

  it('returns unhealthy when DB error', async () => {
    mdb.execute.mockRejectedValue(new Error('Connection refused'))
    const r = await GET(new NextRequest('http://localhost'))
    const b = await r.json()
    expect(b.status).toBe('unhealthy')
  })
})

describe('health/db', () => {
  it('returns table info', async () => {
    const r = await GET_DB(new NextRequest('http://localhost'))
    const b = await r.json()
    expect(b.tables_expected).toBe(16)
    expect(b.status).toBe('complete')
  })

  it('returns error for missing table', async () => {
    mdb.execute.mockRejectedValueOnce(new Error('relation does not exist'))
    const r = await GET_DB(new NextRequest('http://localhost'))
    const b = await r.json()
    expect(b.status).toBe('incomplete')
  })
})
