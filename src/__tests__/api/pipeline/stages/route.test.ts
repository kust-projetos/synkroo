/** Tests for pipeline stages routes — Drizzle + services mocks */
const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/services/pipeline/stages.service', () => ({
  getPipelineStages: jest.fn(),
  createPipelineStage: jest.fn(),
  updatePipelineStage: jest.fn(),
  deletePipelineStage: jest.fn(),
  reorderPipelineStages: jest.fn(),
}))

const { getPipelineStages, createPipelineStage, updatePipelineStage, deletePipelineStage, reorderPipelineStages } = require('@/services/pipeline/stages.service')
const authOk = () => mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1' } })
const authFail = () => mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })

import { NextRequest } from 'next/server'
import { GET, POST } from '../../../../app/api/pipeline/stages/route'
import { PATCH as PATCH_ID, DELETE } from '../../../../app/api/pipeline/stages/[id]/route'
import { PATCH as REORDER } from '../../../../app/api/pipeline/stages/reorder/route'

beforeEach(() => { jest.clearAllMocks() })

describe('pipeline/stages', () => {
  describe('GET', () => {
    it('returns 401', async () => { authFail(); const r = await GET(new NextRequest('http://localhost')); expect(r.status).toBe(401) })
    it('returns stages', async () => { authOk(); getPipelineStages.mockResolvedValue([{ id: 's1', name: 'Novo' }]); const r = await GET(new NextRequest('http://localhost')); const b = await r.json(); expect(b.data).toHaveLength(1) })
  })
  describe('POST', () => {
    it('returns 401', async () => { authFail(); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ name: 'X', color: '#fff' }) })); expect(r.status).toBe(401) })
    it('returns 400 for missing fields', async () => { authOk(); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) })); expect(r.status).toBe(400) })
    it('creates stage', async () => { authOk(); createPipelineStage.mockResolvedValue({ id: 's1', name: 'X' }); const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ name: 'X', color: '#fff' }) })); expect(r.status).toBe(201) })
  })
})

describe('pipeline/stages/[id]', () => {
  describe('PATCH', () => {
    it('returns 401', async () => { authFail(); const r = await PATCH_ID(new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({}) }), { params: Promise.resolve({ id: 's1' }) }); expect(r.status).toBe(401) })
    it('updates stage', async () => { authOk(); updatePipelineStage.mockResolvedValue({ id: 's1', name: 'Updated' }); const r = await PATCH_ID(new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({ name: 'Updated' }) }), { params: Promise.resolve({ id: 's1' }) }); const b = await r.json(); expect(b.data.name).toBe('Updated') })
  })
  describe('DELETE', () => {
    it('returns 401', async () => { authFail(); const r = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 's1' }) }); expect(r.status).toBe(401) })
    it('deletes stage', async () => { authOk(); deletePipelineStage.mockResolvedValue(undefined); const r = await DELETE(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 's1' }) }); const b = await r.json(); expect(b.success).toBe(true) })
  })
})

describe('pipeline/stages/reorder', () => {
  it('returns 401', async () => { authFail(); const r = await REORDER(new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({ stages: [] }) })); expect(r.status).toBe(401) })
  it('reorders', async () => { authOk(); reorderPipelineStages.mockResolvedValue(undefined); const r = await REORDER(new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({ stages: [{ id: 's1', sort_order: 0 }] }) })); const b = await r.json(); expect(b.success).toBe(true) })
})
