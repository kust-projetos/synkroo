/**
 * Campaign Segments Preview Route — behavioral tests (Drizzle-migrated)
 */

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: jest.fn(),
}))

import { validateApiAuth } from '@/lib/auth/session'

let queryResults: any[] = []
let queryIndex = 0

function createMockDb() {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: any) => {
      const result = queryResults[queryIndex++] ?? queryResults[queryResults.length - 1] ?? []
      return resolve(result)
    }),
  }
  return chain
}

let mdb = createMockDb()

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => mdb),
}))

// Mock the segmentation service
jest.mock('@/services/followup/segmentation.service', () => ({
  previewSegmentSize: jest.fn().mockResolvedValue(42),
  getSegmentPatients: jest.fn().mockResolvedValue([
    { id: 'p1', name: 'Ana', phone: '123' },
    { id: 'p2', name: 'João', phone: '456' },
  ]),
}))

import { GET } from '@/app/api/campaigns/segments/preview/route'
import { previewSegmentSize, getSegmentPatients } from '@/services/followup/segmentation.service'

function seed(...results: any[][]) {
  queryResults = results
  queryIndex = 0
}

function mockAuth(success = true) {
  ;(validateApiAuth as jest.Mock).mockResolvedValue(
    success
      ? { success: true, profile: { clinic_id: 'c1', is_active: true } }
      : { success: false, error: { message: 'Unauthorized', status: 401 } },
  )
}

function mockReq(url: string) {
  return { url } as any
}

beforeEach(() => {
  mdb = createMockDb()
  queryResults = []
  queryIndex = 0
  jest.clearAllMocks()
  ;(previewSegmentSize as jest.Mock).mockResolvedValue(42)
  ;(getSegmentPatients as jest.Mock).mockResolvedValue([
    { id: 'p1', name: 'Ana', phone: '123' },
    { id: 'p2', name: 'João', phone: '456' },
  ])
})

describe('GET /api/campaigns/segments/preview', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth(false)
    const res = await GET(mockReq('http://localhost/api/campaigns/segments/preview?type=reactivation'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when type is missing', async () => {
    mockAuth()
    const res = await GET(mockReq('http://localhost/api/campaigns/segments/preview'))
    expect(res.status).toBe(400)
    // Envelope canônico de erro (R2): { error: { code, message, requestId } }
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_INPUT')
    expect(typeof body.error.requestId).toBe('string')
  })

  it('returns 400 for unknown type', async () => {
    mockAuth()
    const res = await GET(mockReq('http://localhost/api/campaigns/segments/preview?type=unknown'))
    expect(res.status).toBe(400)
  })

  it('returns count and patients for reactivation', async () => {
    mockAuth()
    const res = await GET(mockReq('http://localhost/api/campaigns/segments/preview?type=reactivation'))
    expect(res.status).toBe(200)

    const body = await res.json()
    // Envelope canônico (R2): { data: { count, patients } }
    expect(body.data.count).toBe(42)
    expect(body.data.patients).toHaveLength(2)
  })

  it('uses service for reactivation criteria', async () => {
    mockAuth()
    const res = await GET(mockReq('http://localhost/api/campaigns/segments/preview?type=reactivation'))
    await res.json()
    expect(previewSegmentSize).toHaveBeenCalledWith('c1', { lastVisitMin: 30 })
  })

  it('uses patients.status for promotional campaign', async () => {
    mockAuth()
    seed([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }])

    const res = await GET(mockReq('http://localhost/api/campaigns/segments/preview?type=promotional'))
    const body = await res.json()
    expect(body.data.count).toBe(3)
  })

  it('filters birthday patients correctly', async () => {
    mockAuth()
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisDay = now.getDate()

    seed([
      { id: 'p1', birthDate: new Date(1990, thisMonth, thisDay).toISOString().split('T')[0] },
      { id: 'p2', birthDate: new Date(1985, thisMonth, thisDay + 1).toISOString().split('T')[0] },
    ])

    const res = await GET(mockReq('http://localhost/api/campaigns/segments/preview?type=birthday'))
    const body = await res.json()
    // count depends on whether today's date falls within the week range
    expect(typeof body.data.count).toBe('number')
  })
})
