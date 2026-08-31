/** Tests for pipeline stages routes — adapted for comercial module routes */

// Mock module manifest
const mockIsEnabled = jest.fn().mockResolvedValue(true)
jest.mock('@/core/modules/manifest', () => ({
  createManifest: () => ({
      isEnabled: mockIsEnabled, enabledModules: jest.fn() }),
}))

// Mock auth context (replaces old validateApiAuth)
const mockBuildUserContext = jest.fn()
jest.mock('@/core/actions/context', () => ({
  buildUserContext: mockBuildUserContext,
}))

// Mock action system
jest.mock('@/core/actions/run', () => ({
  runAction: jest.fn().mockImplementation(async (action, input) => ({ ok: true, data: { stages: [] } })),
}))

// Mock comercial actions
jest.mock('@/modules/comercial/actions/listar-pipeline', () => ({
  listarPipeline: { name: 'comercial.listarPipeline', module: 'comercial', requires: 'comercial:view', label: 'Listar pipeline', input: {} as any, handler: jest.fn() },
}))
jest.mock('@/modules/comercial/actions/criar-etapa-pipeline', () => ({
  criarEtapaPipeline: { name: 'comercial.criarEtapaPipeline', module: 'comercial', requires: 'comercial:manage_pipeline', label: 'Criar etapa', input: {} as any, handler: jest.fn() },
}))
jest.mock('@/modules/comercial/actions/atualizar-etapa-pipeline', () => ({
  atualizarEtapaPipeline: { name: 'comercial.atualizarEtapaPipeline', module: 'comercial', requires: 'comercial:manage_pipeline', label: 'Atualizar etapa', input: {} as any, handler: jest.fn() },
}))
jest.mock('@/modules/comercial/actions/remover-etapa-pipeline', () => ({
  removerEtapaPipeline: { name: 'comercial.removerEtapaPipeline', module: 'comercial', requires: 'comercial:manage_pipeline', label: 'Remover etapa', input: {} as any, handler: jest.fn() },
}))
jest.mock('@/modules/comercial/actions/reordenar-etapas-pipeline', () => ({
  reordenarEtapasPipeline: { name: 'comercial.reordenarEtapasPipeline', module: 'comercial', requires: 'comercial:manage_pipeline', label: 'Reordenar etapas', input: {} as any, handler: jest.fn() },
}))

const authOk = () => mockBuildUserContext.mockResolvedValue({
  clinicId: 'c1',
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'test' },
})
const authFail = () => mockBuildUserContext.mockRejectedValue(new Error('unauthenticated'))

import { NextRequest } from 'next/server'
import { GET, POST } from '../../../../app/api/pipeline/stages/route'
import { PATCH as PATCH_ID, DELETE } from '../../../../app/api/pipeline/stages/[id]/route'
import { PATCH as REORDER } from '../../../../app/api/pipeline/stages/reorder/route'

beforeEach(() => { jest.clearAllMocks(); mockIsEnabled.mockResolvedValue(true) })

describe('pipeline/stages', () => {
  describe('GET', () => {
    it('returns 401 when unauthorized', async () => {
      authFail()
      const r = await GET(new NextRequest('http://localhost'))
      expect(r.status).toBe(401)
    })
    it('returns 200 when authorized', async () => {
      authOk()
      const r = await GET(new NextRequest('http://localhost'))
      expect(r.status).toBe(200)
    })
  })
  describe('POST', () => {
    it('returns 401 when unauthorized', async () => {
      authFail()
      const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ name: 'X', color: '#fff' }) }))
      expect(r.status).toBe(401)
    })
  })
  describe('PATCH [id]', () => {
    it('returns 401 when unauthorized', async () => {
      authFail()
      const r = await PATCH_ID(new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({}) }), { params: Promise.resolve({ id: 's1' }) })
      expect(r.status).toBe(401)
    })
  })
  describe('DELETE [id]', () => {
    it('returns 401 when unauthorized', async () => {
      authFail()
      const r = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 's1' }) })
      expect(r.status).toBe(401)
    })
  })
  describe('REORDER', () => {
    it('returns 401 when unauthorized', async () => {
      authFail()
      const r = await REORDER(new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({ stages: [] }) }))
      expect(r.status).toBe(401)
    })
  })
})
