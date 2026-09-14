/**
 * D2 lote 2/5 (comercial) — contract test de caracterização.
 *
 * As rotas /api/leads já estão no contrato canônico (withModuleRoute +
 * runComercialAction → envelope { data } / { error }). Este teste fixa o
 * contrato atual (status + envelope) como rede de proteção; a D3 altera o
 * POST inválido de 422 (validação da Action) para 400 (Zod na rota).
 */
const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/core/modules/manifest', () => require('../../_setup/route-mocks').manifestMock)
jest.mock('@/core/actions/context', () => require('../../_setup/route-mocks').contextMock)
jest.mock('@/core/actions/run', () => ({ runAction: jest.fn() }))

import { buildUserContext } from '@/core/actions/context'
import { runAction } from '@/core/actions/run'

const authOk = () => {
  mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1' } })
  ;(buildUserContext as jest.Mock).mockResolvedValue({
    source: 'user', clinicId: 'c1', user: { id: 'u1', email: 'u@x.com', name: 'U' },
    can: () => true, hasModule: () => true, audit: { actor: 'u1' },
  })
}
const authFail = () => {
  mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
  ;(buildUserContext as jest.Mock).mockRejectedValue(new Error('unauthenticated'))
}
beforeEach(() => { jest.clearAllMocks() })

import { NextRequest } from 'next/server'
import { GET, POST } from '../../../../app/api/leads/route'

describe('D2 lote 2 — GET /api/leads (canônico)', () => {
  it('401 envelope canônico quando não autenticado', async () => {
    authFail()
    const r = await GET(new NextRequest('http://localhost/api/leads'))
    expect(r.status).toBe(401)
    const b = await r.json()
    expect(b.error.code).toBe('UNAUTHORIZED')
    expect(typeof b.error.requestId).toBe('string')
  })

  it('200 envelope canônico { data } quando autenticado', async () => {
    authOk()
    ;(runAction as jest.Mock).mockResolvedValue({ ok: true, data: [{ id: 'l1' }] })
    const r = await GET(new NextRequest('http://localhost/api/leads'))
    expect(r.status).toBe(200)
    const b = await r.json()
    expect(b.data).toEqual([{ id: 'l1' }])
    expect(r.headers.get('x-request-id')).toBeTruthy()
  })
})

describe('D2 lote 2 / D3 — POST /api/leads (canônico, Zod na rota)', () => {
  it('200/201 envelope canônico em payload válido', async () => {
    authOk()
    ;(runAction as jest.Mock).mockResolvedValue({ ok: true, data: { id: 'l1', name: 'Ana' } })
    const r = await POST(new NextRequest('http://localhost/api/leads', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ana', phone: '+5511999990001', source: 'website' }),
    }))
    expect([200, 201]).toContain(r.status)
    const b = await r.json()
    expect(b.data).toEqual({ id: 'l1', name: 'Ana' })
  })

  it('400 INVALID_INPUT canônico em payload inválido (Zod na rota, D3)', async () => {
    authOk()
    const r = await POST(new NextRequest('http://localhost/api/leads', {
      method: 'POST',
      body: JSON.stringify({ name: '', phone: '' }),
    }))
    expect(r.status).toBe(400)
    const b = await r.json()
    expect(b.error.code).toBe('INVALID_INPUT')
    expect(runAction).not.toHaveBeenCalled()
  })

  it.each([
    'whatsapp', 'instagram', 'web', 'website', 'referral', 'campaign', 'manual', 'other',
  ])('fonte %s passa pelo schema (nunca 400 de schema)', async (source) => {
    authOk()
    ;(runAction as jest.Mock).mockResolvedValue({ ok: true, data: { leadId: 'l1' } })
    const r = await POST(new NextRequest('http://localhost/api/leads', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ana', phone: '+5511999990001', source }),
    }))
    // 200/201 de negócio (ou 422 de negócio, conforme a Action) — nunca 400 de schema
    expect(r.status).not.toBe(400)
    expect(runAction).toHaveBeenCalled()
  })

  it('fonte fora do enum → 400 canônico', async () => {
    authOk()
    const r = await POST(new NextRequest('http://localhost/api/leads', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ana', phone: '+5511999990001', source: 'carrier-pigeon' }),
    }))
    expect(r.status).toBe(400)
    expect((await r.json()).error.code).toBe('INVALID_INPUT')
    expect(runAction).not.toHaveBeenCalled()
  })
})
