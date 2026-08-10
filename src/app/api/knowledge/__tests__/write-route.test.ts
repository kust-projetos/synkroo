import { NextRequest } from 'next/server'

const mockValidateApiAuth = jest.fn()
const mockInsertReturning = jest.fn()
const mockUpdateReturning = jest.fn()
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

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: mockValidateApiAuth,
}))

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => ({
    insert: jest.fn(() => mockInsertBuilder),
    update: jest.fn(() => mockUpdateBuilder),
  })),
}))

jest.mock('drizzle-orm', () => {
  const actual = jest.requireActual('drizzle-orm')
  return {
    ...actual,
    and: jest.fn((...clauses: unknown[]) => ({ kind: 'and', clauses })),
    eq: jest.fn((column: unknown, value: unknown) => ({ kind: 'eq', column, value })),
  }
})

import { POST } from '@/app/api/knowledge/route'
import { PUT } from '@/app/api/knowledge/[id]/route'

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

beforeEach(() => {
  jest.clearAllMocks()
  auth()
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
    expect(payload.data.clinic_id).toBe(CLINIC_A)
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
})
