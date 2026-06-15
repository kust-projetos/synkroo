/**
 * LGPD Export Route — behavioral tests (with consents)
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

import { POST } from '@/app/api/lgpd/export/route'

function seed(...results: any[][]) {
  queryResults = results
  queryIndex = 0
}

function mockAuth(clinicId = 'c1', success = true) {
  ;(validateApiAuth as jest.Mock).mockResolvedValue(
    success
      ? { success: true, profile: { clinic_id: clinicId, is_active: true } }
      : { success: false, error: { message: 'Unauthorized', status: 401 } },
  )
}

function mockReq(body: any) {
  return { json: () => Promise.resolve(body) } as any
}

beforeEach(() => {
  mdb = createMockDb()
  queryResults = []
  queryIndex = 0
})

describe('POST /api/lgpd/export', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth('c1', false)
    const res = await POST(mockReq({ patientId: 'p1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when patientId is missing', async () => {
    mockAuth('c1')
    const res = await POST(mockReq({}))
    expect(res.status).toBe(400)
  })

  it('returns full patient data including consents', async () => {
    mockAuth('c1')
    seed(
      [{ id: 'p1', name: 'João', phone: '123', clinicId: 'c1' }],           // patient
      [{ id: 'a1', patientId: 'p1', status: 'completed' }],                   // appointments
      [],                                                                      // budgets
      [{ id: 'pay1', patientId: 'p1', amount: '100.00' }],                    // payments
      [{ id: 'c1', contactId: 'p1', contactType: 'patient', purpose: 'marketing', granted: true }], // consents
    )

    const res = await POST(mockReq({ patientId: 'p1' }))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.patient).not.toBeNull()
    expect(data.consents).toHaveLength(1)
    expect(data.consents[0].purpose).toBe('marketing')
    expect(data.consents[0].contactType).toBe('patient')
  })

  it('returns empty consents when none found', async () => {
    mockAuth('c1')
    seed([{ id: 'p1', name: 'João', clinicId: 'c1' }], [], [], [], [])

    const res = await POST(mockReq({ patientId: 'p1' }))
    const data = await res.json()
    expect(data.consents).toEqual([])
  })
})
