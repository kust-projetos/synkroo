import { NextRequest } from 'next/server'

const mockValidateApiAuth = jest.fn()
const mockInsertReturning = jest.fn()
const mockUpdateReturning = jest.fn()
let mockSelectRows: unknown[] = []
const mockSelectLimit = jest.fn()
const mockSelectOrderBy = jest.fn()
const mockSelectWhere = jest.fn()
const mockSelectFrom = jest.fn()
const mockSelectFn = jest.fn()
const mockInsertBuilder = {
  values: jest.fn(),
  returning: mockInsertReturning,
}
const mockUpdateBuilder = {
  set: jest.fn(),
  where: jest.fn(),
  returning: mockUpdateReturning,
}

mockInsertBuilder.values.mockReturnValue(mockInsertBuilder)
mockUpdateBuilder.set.mockReturnValue(mockUpdateBuilder)
mockUpdateBuilder.where.mockReturnValue(mockUpdateBuilder)
mockSelectFn.mockImplementation(() => ({ from: mockSelectFrom }))
mockSelectFrom.mockImplementation(() => ({ where: mockSelectWhere }))
mockSelectWhere.mockImplementation((clause: unknown) => {
  const awaitingList: any = Promise.resolve(mockSelectRows)
  awaitingList.orderBy = (...args: unknown[]) => {
    mockSelectOrderBy(...args)
    const awaitingLimit: any = Promise.resolve(mockSelectRows)
    awaitingLimit.limit = (...limitArgs: unknown[]) => {
      mockSelectLimit(...limitArgs)
      return Promise.resolve(mockSelectRows)
    }
    return awaitingLimit
  }
  // Preserve the where clause for assertions (and() is mocked below).
  void clause
  return awaitingList
})

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: mockValidateApiAuth,
}))

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => ({
    insert: jest.fn(() => mockInsertBuilder),
    update: jest.fn(() => mockUpdateBuilder),
    select: mockSelectFn,
  })),
}))

jest.mock('drizzle-orm', () => {
  const actual = jest.requireActual('drizzle-orm')
  return {
    ...actual,
    and: jest.fn((...clauses: unknown[]) => ({ kind: 'and', clauses })),
    eq: jest.fn((column: unknown, value: unknown) => ({ kind: 'eq', column, value })),
    or: jest.fn((...clauses: unknown[]) => ({ kind: 'or', clauses })),
    ilike: jest.fn((column: unknown, value: unknown) => ({ kind: 'ilike', column, value })),
    desc: jest.fn((column: unknown) => ({ kind: 'desc', column })),
  }
})

import { GET, POST } from '@/app/api/knowledge/route'
import { GET as GET_BY_ID, PUT } from '@/app/api/knowledge/[id]/route'

const CLINIC_A = '00000000-0000-0000-0000-00000000000a'
const ENTRY_ID = '00000000-0000-0000-0000-000000000001'
const row = {
  id: ENTRY_ID,
  clinicId: CLINIC_A,
  category: 'horarios',
  question: 'Qual o horário?',
  answer: 'Atendemos das 8h às 18h.',
  keywords: ['horário'],
  isActive: true,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
}

function auth(clinicId = CLINIC_A) {
  mockValidateApiAuth.mockResolvedValue({
    success: true,
    profile: { id: 'user-1', clinic_id: clinicId, role: 'owner' },
  })
}

function authFail() {
  mockValidateApiAuth.mockResolvedValue({
    success: false,
    error: { message: 'Unauthorized', status: 401 },
  })
}

function request(method: string, body: unknown) {
  return new NextRequest('http://localhost/api/knowledge', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function getRequest(url: string) {
  return new NextRequest(url, { method: 'GET' })
}

beforeEach(() => {
  jest.clearAllMocks()
  auth()
  mockSelectRows = [row]
  mockInsertReturning.mockResolvedValue([row])
  mockUpdateReturning.mockResolvedValue([row])
})

describe('POST /api/knowledge', () => {
  it('rejects unauthenticated requests', async () => {
    authFail()

    const response = await POST(request('POST', { category: 'x', question: 'q', answer: 'a' }))

    expect(response.status).toBe(401)
  })

  it('validates required fields before persistence', async () => {
    const response = await POST(request('POST', { category: 'x', question: 'q' }))

    expect(response.status).toBe(400)
    expect(mockInsertReturning).not.toHaveBeenCalled()
  })

  it('persists the authenticated clinic id and returns the created entry', async () => {
    const response = await POST(request('POST', {
      category: 'horarios',
      question: 'Qual o horário?',
      answer: 'Atendemos das 8h às 18h.',
      keywords: ['horário'],
    }))
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(mockInsertBuilder.values).toHaveBeenCalledWith(expect.objectContaining({
      clinicId: CLINIC_A,
      category: 'horarios',
      question: 'Qual o horário?',
      answer: 'Atendemos das 8h às 18h.',
      keywords: ['horário'],
      isActive: true,
    }))
    expect(payload.data.clinicId).toBe(CLINIC_A)
  })
})

describe('PUT /api/knowledge/[id]', () => {
  const params = { params: Promise.resolve({ id: ENTRY_ID }) }

  it('rejects an empty update', async () => {
    const response = await PUT(request('PUT', {}), params)

    expect(response.status).toBe(400)
    expect(mockUpdateReturning).not.toHaveBeenCalled()
  })

  it('updates only within the authenticated clinic scope', async () => {
    const response = await PUT(request('PUT', { answer: 'Novo horário.' }), params)
    const whereClause = mockUpdateBuilder.where.mock.calls[0][0] as { clauses: Array<{ value?: string }> }

    expect(response.status).toBe(200)
    expect(mockUpdateBuilder.set).toHaveBeenCalledWith(expect.objectContaining({
      answer: 'Novo horário.',
      updatedAt: expect.any(Date),
    }))
    expect(whereClause.clauses).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: ENTRY_ID }),
      expect.objectContaining({ value: CLINIC_A }),
    ]))
  })

  it('returns 404 when the entry is not in the authenticated clinic', async () => {
    mockUpdateReturning.mockResolvedValue([])

    const response = await PUT(request('PUT', { answer: 'Novo horário.' }), params)

    expect(response.status).toBe(404)
  })

  it('accepts camelCase isActive:false and returns the camelCase payload', async () => {
    mockUpdateReturning.mockResolvedValue([{ ...row, isActive: false }])

    const response = await PUT(request('PUT', { isActive: false }), params)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockUpdateBuilder.set).toHaveBeenCalledWith(expect.objectContaining({
      isActive: false,
      updatedAt: expect.any(Date),
    }))
    expect(payload.data.isActive).toBe(false)
    expect(payload.data.is_active).toBeUndefined()
  })

  it('accepts legacy is_active:false and returns the camelCase payload', async () => {
    mockUpdateReturning.mockResolvedValue([{ ...row, isActive: false }])

    const response = await PUT(request('PUT', { is_active: false }), params)
    const payload = await response.json()

    expect(response.status).toBeLessThan(300)
    expect(mockUpdateBuilder.set).toHaveBeenCalledWith(expect.objectContaining({
      isActive: false,
      updatedAt: expect.any(Date),
    }))
    expect(payload.data.isActive).toBe(false)
  })

  it('prefers camelCase isActive when both isActive and is_active are sent', async () => {
    mockUpdateReturning.mockResolvedValue([{ ...row, isActive: false }])

    const response = await PUT(request('PUT', { isActive: false, is_active: true }), params)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockUpdateBuilder.set).toHaveBeenCalledWith(expect.objectContaining({
      isActive: false,
      updatedAt: expect.any(Date),
    }))
    expect(payload.data.isActive).toBe(false)
    expect(payload.data.is_active).toBeUndefined()
  })
})

describe('GET /api/knowledge', () => {
  it('lists entries of the authenticated clinic in camelCase with ISO dates', async () => {
    const second = {
      ...row,
      id: '00000000-0000-0000-0000-000000000002',
      question: 'Aceitam convênio?',
      answer: 'Sim, vários convênios.',
    }
    mockSelectRows = [row, second]

    const response = await GET(getRequest('http://localhost/api/knowledge'))
    const payload = await response.json()
    const whereClause = mockSelectWhere.mock.calls[0][0] as { clauses: Array<{ value?: string }> }

    expect(response.status).toBe(200)
    expect(Array.isArray(payload.data)).toBe(true)
    expect(payload.data).toHaveLength(2)
    for (const item of payload.data) {
      expect(item.clinicId).toBe(CLINIC_A)
      expect(typeof item.isActive).toBe('boolean')
      expect(item.createdAt).toBe(row.createdAt.toISOString())
      expect(item.updatedAt).toBe(row.updatedAt.toISOString())
      expect(item).not.toHaveProperty('clinic_id')
      expect(item).not.toHaveProperty('is_active')
      expect(item).not.toHaveProperty('created_at')
      expect(item).not.toHaveProperty('updated_at')
      expect(Object.keys(item).every((key: string) => !key.includes('_'))).toBe(true)
    }
    expect(whereClause.clauses).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: CLINIC_A }),
    ]))
  })
})

describe('GET /api/knowledge/[id]', () => {
  const params = { params: Promise.resolve({ id: ENTRY_ID }) }

  it('preserves embedding in the camelCase payload', async () => {
    const embedding = [0.1, 0.2, 0.3]
    mockSelectRows = [{ ...row, embedding }]

    const response = await GET_BY_ID(getRequest(`http://localhost/api/knowledge/${ENTRY_ID}`), params)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.embedding).toEqual(embedding)
    expect(payload.data.clinicId).toBe(CLINIC_A)
  })
})
