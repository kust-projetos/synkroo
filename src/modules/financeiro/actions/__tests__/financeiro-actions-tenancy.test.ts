import type { ActionContext } from '@/core/actions/types'
import { runAction } from '@/core/actions/run'
import {
  criarOrcamento,
  gerarCobranca,
  aceitarOrcamento,
  rejeitarOrcamento,
  salvarGateway,
  salvarRegraRoteamento,
} from '../index'
import * as budgetService from '../../services/budget-service'
import * as chargeService from '../../services/charge-service'
import * as gatewayConfigService from '../../services/gateway-config-service'

jest.mock('../../services/budget-service', () => ({
  createBudget: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001' }),
  acceptBudget: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001', status: 'accepted' }),
  rejectBudget: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001', status: 'rejected' }),
  getBudget: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001', patientId: '00000000-0000-0000-0000-000000000010' }),
}))

jest.mock('../../services/charge-service', () => ({
  createCharge: jest.fn().mockResolvedValue({
    charge: { id: '00000000-0000-0000-0000-000000000001' },
    gatewayResponse: { paymentUrl: 'https://pay.test', pixQrCode: 'pix-test', status: 'pending' },
  }),
}))

jest.mock('../../services/gateway-config-service', () => ({
  saveGateway: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001' }),
  saveRoutingRule: jest.fn().mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001' }),
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

describe('Financeiro Actions — Tenancy fail-closed boundary (RED)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('criarOrcamento rejects foreign clinicId with invalid_input (guard before parse)', async () => {
    const res = await runAction(criarOrcamento, {
      clinicId: FOREIGN_CLINIC_ID,
      patientId: '00000000-0000-0000-0000-000000000010',
      items: [{ procedureName: 'Limpeza', unitPrice: 150 }],
    }, ctxA)

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('invalid_input')
    }
    expect(budgetService.createBudget).not.toHaveBeenCalled()
  })

  it('gerarCobranca rejects foreign clinicId with invalid_input', async () => {
    const res = await runAction(gerarCobranca, {
      clinicId: FOREIGN_CLINIC_ID,
      budgetId: '00000000-0000-0000-0000-000000000020',
      dueDate: '2026-09-01',
      amount: 150,
    }, ctxA)

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('invalid_input')
    }
    expect(chargeService.createCharge).not.toHaveBeenCalled()
  })

  it('aceitarOrcamento rejects foreign clinicId with invalid_input', async () => {
    const res = await runAction(aceitarOrcamento, {
      clinicId: FOREIGN_CLINIC_ID,
      id: '00000000-0000-0000-0000-000000000020',
    }, ctxA)

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('invalid_input')
    }
    expect(budgetService.acceptBudget).not.toHaveBeenCalled()
  })

  it('rejeitarOrcamento rejects foreign clinicId with invalid_input', async () => {
    const res = await runAction(rejeitarOrcamento, {
      clinicId: FOREIGN_CLINIC_ID,
      id: '00000000-0000-0000-0000-000000000020',
    }, ctxA)

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('invalid_input')
    }
    expect(budgetService.rejectBudget).not.toHaveBeenCalled()
  })

  it('salvarGateway rejects foreign clinicId with invalid_input', async () => {
    const res = await runAction(salvarGateway, {
      clinicId: FOREIGN_CLINIC_ID,
      provider: 'asaas',
      isDefault: false,
      isEnabled: true,
    }, ctxA)

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('invalid_input')
    }
    expect(gatewayConfigService.saveGateway).not.toHaveBeenCalled()
  })

  it('salvarRegraRoteamento rejects foreign clinicId with invalid_input', async () => {
    const res = await runAction(salvarRegraRoteamento, {
      clinicId: FOREIGN_CLINIC_ID,
      gatewayId: '00000000-0000-0000-0000-000000000030',
      patientId: '00000000-0000-0000-0000-000000000010',
    }, ctxA)

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('invalid_input')
    }
    expect(gatewayConfigService.saveRoutingRule).not.toHaveBeenCalled()
  })
})
