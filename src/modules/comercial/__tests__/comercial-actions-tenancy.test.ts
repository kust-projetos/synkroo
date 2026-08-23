import type { ActionContext } from '@/core/actions/types'
import { runAction } from '@/core/actions/run'
import {
  atualizarEtapaPipeline,
  criarTaskComercial,
  moverLeadEtapaAction,
  converterLead,
  fecharTaskComercial,
  removerEtapaPipeline,
} from '../actions'
import * as pipelineRepo from '../repositories/pipeline-repository'
import * as tasksService from '../services/tasks-service'
import * as leadsRepo from '../repositories/leads-repository'

jest.mock('../repositories/pipeline-repository', () => ({
  updateStage: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000010' }),
  findStageById: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000010', clinicId: '00000000-0000-0000-0000-000000000002' }),
  deleteStage: jest.fn().mockResolvedValue({ success: true }),
  moveLeadStage: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000020' }),
}))

jest.mock('../services/tasks-service', () => ({
  criarTask: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000030' }),
  fecharTask: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000030' }),
}))

jest.mock('../repositories/leads-repository', () => ({
  findLeadByIdForClinic: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000020', clinicId: '00000000-0000-0000-0000-000000000002' }),
  updateLead: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000020', status: 'converted' }),
}))

const ctxA: ActionContext = {
  source: 'user',
  clinicId: '00000000-0000-0000-0000-000000000001',
  user: { id: 'user-1', email: 'user@example.test', name: 'User' },
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'user-1' },
}

const FOREIGN_CLINIC_ID = '00000000-0000-0000-0000-000000000002'

describe('Comercial Actions — Tenancy fail-closed boundary (RED)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('atualizarEtapaPipeline rejects foreign clinicId with forbidden', async () => {
    const res = await runAction(atualizarEtapaPipeline, {
      clinicId: FOREIGN_CLINIC_ID,
      stageId: '00000000-0000-0000-0000-000000000010',
      name: 'Etapa B',
    }, ctxA)

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('forbidden')
    }
    expect(pipelineRepo.updateStage).not.toHaveBeenCalled()
  })

  it('criarTaskComercial rejects foreign clinicId with forbidden', async () => {
    const res = await runAction(criarTaskComercial, {
      clinicId: FOREIGN_CLINIC_ID,
      title: 'Ligar para lead',
      leadId: '00000000-0000-0000-0000-000000000020',
    }, ctxA)

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('forbidden')
    }
    expect(tasksService.criarTask).not.toHaveBeenCalled()
  })

  it('moverLeadEtapaAction rejects foreign clinicId with forbidden', async () => {
    const res = await runAction(moverLeadEtapaAction, {
      clinicId: FOREIGN_CLINIC_ID,
      leadId: '00000000-0000-0000-0000-000000000020',
      stageId: '00000000-0000-0000-0000-000000000010',
    }, ctxA)

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('forbidden')
    }
  })

  it('converterLead rejects foreign clinicId with forbidden', async () => {
    const res = await runAction(converterLead, {
      clinicId: FOREIGN_CLINIC_ID,
      leadId: '00000000-0000-0000-0000-000000000020',
      patientId: '00000000-0000-0000-0000-000000000040',
    }, ctxA)

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('forbidden')
    }
    expect(leadsRepo.updateLead).not.toHaveBeenCalled()
  })

  it('fecharTaskComercial rejects foreign clinicId with forbidden', async () => {
    const res = await runAction(fecharTaskComercial, {
      clinicId: FOREIGN_CLINIC_ID,
      taskId: '00000000-0000-0000-0000-000000000030',
      status: 'completed',
    }, ctxA)

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('forbidden')
    }
    expect(tasksService.fecharTask).not.toHaveBeenCalled()
  })

  it('removerEtapaPipeline rejects foreign clinicId with forbidden', async () => {
    const res = await runAction(removerEtapaPipeline, {
      clinicId: FOREIGN_CLINIC_ID,
      stageId: '00000000-0000-0000-0000-000000000010',
    }, ctxA)

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('forbidden')
    }
    expect(pipelineRepo.deleteStage).not.toHaveBeenCalled()
  })
})
