/** Tests for health routes — liveness puro + db sanitizado (F2) */
const mdb = {
  execute: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
} as any
jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mdb) }))

import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db/client'
import { GET } from '../../../app/api/health/route'
import { GET as GET_DB } from '../../../app/api/health/db/route'

const mockGetDb = getDb as jest.Mock
const DRIVER_MARKER = 'DRIVER_SECRET_MARKER_9f8b'

beforeEach(() => {
  jest.clearAllMocks()
  mdb.execute.mockResolvedValue({ rows: [{ '?column?': 1 }] })
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

describe('health/db (sanitizado)', () => {
  it('retorna agregado sem enumeração por tabela', async () => {
    const r = await GET_DB(new NextRequest('http://localhost'))
    const b = await r.json()
    expect(b.status).toBe('complete')
    expect(b.complete).toBe(true)
    expect(b.tables_expected).toBe(16)
    expect(b.tables_created).toBe(16)
    expect(b).not.toHaveProperty('tables')
  })

  it('incompleto quando uma tabela falta, sem error.message do driver', async () => {
    mdb.execute.mockRejectedValueOnce(new Error(`${DRIVER_MARKER} relation does not exist`))
    const r = await GET_DB(new NextRequest('http://localhost'))
    const b = await r.json()
    expect(b.status).toBe('incomplete')
    expect(b.complete).toBe(false)
    expect(JSON.stringify(b)).not.toContain(DRIVER_MARKER)
    expect(b).not.toHaveProperty('tables')
  })

  it('falha total do DB não vaza mensagem do driver', async () => {
    mdb.execute.mockRejectedValue(new Error(`${DRIVER_MARKER} connection refused`))
    const r = await GET_DB(new NextRequest('http://localhost'))
    const b = await r.json()
    expect(b.status).toBe('incomplete')
    expect(JSON.stringify(b)).not.toContain(DRIVER_MARKER)
  })
})
