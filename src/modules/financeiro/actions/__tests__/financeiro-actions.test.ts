/**
 * Unit tests: Financeiro actions (Task 4).
 *
 * Tests action-level validation rules and service helpers.
 * DB interactions are mocked via jest.setup.ts db-mock.
 */

import { storeReset } from '../../repositories/financeiro-store';
import { criarOrcamento } from '../criar-orcamento';
import { aceitarOrcamento } from '../aceitar-orcamento';
import { gerarCobranca } from '../gerar-cobranca';
import { cancelarCobranca } from '../cancelar-cobranca';
import { salvarGateway } from '../salvar-gateway';
import { salvarRegraRoteamento } from '../salvar-regra-roteamento';
import { listarCobrancasAtrasadas } from '../listar-cobrancas-atrasadas';
import { renderRatio } from '../../services/dashboard-service';
import { saveGateway, maskApiKey, saveRoutingRule } from '../../services/gateway-config-service';
import { calculateBudgetTotals } from '../../services/budget-service';

// Mock DB modules to avoid real DB calls in unit tests
jest.mock('@/lib/db/client', () => {
  const { mockDb } = jest.requireActual('@/test-utils/db-mock');
  return { getDb: jest.fn(() => mockDb), closeDb: jest.fn() };
});
jest.mock('../../repositories/financeiro-repository', () => ({
  ...jest.requireActual('../../repositories/financeiro-repository'),
  createBudget: jest.fn().mockResolvedValue({
    id: 'budget-1',
    clinicId: '00000000-0000-0000-0000-000000000001',
    patientId: '00000000-0000-0000-0000-000000000010',
    leadId: null,
    convertedFromLeadId: null,
    campaignId: null,
    title: null,
    description: null,
    notes: null,
    totalValue: '950',
    discountPercent: '10',
    discountValue: '95',
    finalValue: '855',
    status: 'pending',
    validUntil: null,
    sentAt: null,
    acceptedAt: null,
    rejectedAt: null,
    lastSentAt: null,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
}));

const CLINIC_ID = '00000000-0000-0000-0000-000000000001';
const PATIENT_ID = '00000000-0000-0000-0000-000000000010';
const LEAD_ID = '00000000-0000-0000-0000-000000000011';

beforeEach(() => {
  storeReset();
});

// ══════════════════════════════════════════════
// criarOrcamento
// ══════════════════════════════════════════════

describe('criarOrcamento', () => {
  test('action input validates: rejects both patientId and leadId', async () => {
    await expect(
      criarOrcamento.input.parseAsync({
        patientId: PATIENT_ID,
        leadId: LEAD_ID,
        items: [{ procedureName: 'Teste', quantity: 1, unitPrice: 100 }],
      }),
    ).rejects.toBeTruthy();
  });

  test('action input validates: rejects neither patientId nor leadId', async () => {
    await expect(
      criarOrcamento.input.parseAsync({
        items: [{ procedureName: 'Teste', quantity: 1, unitPrice: 100 }],
      }),
    ).rejects.toBeTruthy();
  });

  test('action input validates: accepts only patientId', async () => {
    const parsed = await criarOrcamento.input.parseAsync({
      patientId: PATIENT_ID,
      items: [{ procedureName: 'Teste', quantity: 1, unitPrice: 100 }],
    });
    expect(parsed.patientId).toBe(PATIENT_ID);
  });

  test('calculateBudgetTotals is deterministic', () => {
    const result = calculateBudgetTotals([
      { procedureName: 'A', quantity: 2, unitPrice: 50 },
      { procedureName: 'B', quantity: 1, unitPrice: 200 },
    ], 10);

    expect(result.totalValue).toBe(300);
    expect(result.discountPercent).toBe(10);
    expect(result.discountValue).toBe(30);
    expect(result.finalValue).toBe(270);
  });

  test('action input rejects missing budget items', async () => {
    await expect(
      criarOrcamento.input.parseAsync({
        patientId: PATIENT_ID,
        items: [],
      }),
    ).rejects.toBeTruthy();
  });
});

// ══════════════════════════════════════════════
// aceitarOrcamento
// ══════════════════════════════════════════════

describe('aceitarOrcamento', () => {
  test('input schema accepts only the budget id', async () => {
    const parsed = await aceitarOrcamento.input.parseAsync({
      id: '00000000-0000-0000-0000-000000000099',
    });
    expect(parsed.id).toBeTruthy();
  });
});

// ══════════════════════════════════════════════
// gerarCobranca
// ══════════════════════════════════════════════

describe('gerarCobranca', () => {
  test('input schema validates required fields', async () => {
    const parsed = await gerarCobranca.input.parseAsync({
      budgetId: '00000000-0000-0000-0000-000000000099',
      dueDate: '2026-08-15',
      amount: 500,
    });
    expect(parsed.amount).toBe(500);
  });
});

// ══════════════════════════════════════════════
// cancelarCobranca
// ══════════════════════════════════════════════

describe('cancelarCobranca', () => {
  test('input schema validates id without a tenant selector', async () => {
    const parsed = await cancelarCobranca.input.parseAsync({
      id: '00000000-0000-0000-0000-000000000099',
    });
    expect(parsed.id).toBeTruthy();
  });
});

// ══════════════════════════════════════════════
// salvarGateway
// ══════════════════════════════════════════════

describe('salvarGateway', () => {
  test('maskApiKey works correctly', () => {
    expect(maskApiKey('abc123')).toBe('**c123');
    expect(maskApiKey('mock_key_abcdef1234567890')).toBe('********************7890');
    expect(maskApiKey('ab')).toBe('****');
  });
});

// ══════════════════════════════════════════════
// salvarRegraRoteamento
// ══════════════════════════════════════════════

describe('salvarRegraRoteamento', () => {
  test('validates single scope via Zod refine', async () => {
    const GATEWAY_ID = '00000000-0000-0000-0000-000000000020';

    // Two scopes → reject
    await expect(
      salvarRegraRoteamento.input.parseAsync({
        gatewayId: GATEWAY_ID,
        campaignId: '00000000-0000-0000-0000-000000000030',
        patientId: '00000000-0000-0000-0000-000000000040',
      }),
    ).rejects.toBeTruthy();

    // Zero scopes → reject
    await expect(
      salvarRegraRoteamento.input.parseAsync({
        gatewayId: GATEWAY_ID,
      }),
    ).rejects.toBeTruthy();
  });

  test('valid: only one scope', async () => {
    const parsed = await salvarRegraRoteamento.input.parseAsync({
      gatewayId: '00000000-0000-0000-0000-000000000020',
      campaignId: '00000000-0000-0000-0000-000000000030',
    });
    expect(parsed.campaignId).toBe('00000000-0000-0000-0000-000000000030');
  });
});

// ══════════════════════════════════════════════
// listarCobrancasAtrasadas
// ══════════════════════════════════════════════

describe('listarCobrancasAtrasadas', () => {
  test('input schema validates page and limit', async () => {
    const parsed = await listarCobrancasAtrasadas.input.parseAsync({
      page: 1,
      limit: 50,
    });
    expect(parsed.page).toBe(1);
  });
});

// ══════════════════════════════════════════════
// renderRatio
// ══════════════════════════════════════════════

describe('renderRatio', () => {
  test('null/undefined renders as dash', () => {
    expect(renderRatio(null)).toBe('—');
    expect(renderRatio(undefined)).toBe('—');
  });

  test('formats valid ratios', () => {
    expect(renderRatio(0.75)).toBe('75%');
    expect(renderRatio(0)).toBe('0%');
    expect(renderRatio(1)).toBe('100%');
    expect(renderRatio(0.333)).toBe('33%');
  });
});

// ══════════════════════════════════════════════
// saveRoutingRule
// ══════════════════════════════════════════════

describe('saveRoutingRule (service)', () => {
  test('throws via assertSingleRoutingScope when multiple scopes provided', async () => {
    await expect(
      saveRoutingRule({
        clinicId: CLINIC_ID,
        gatewayId: '00000000-0000-0000-0000-000000000020',
        campaignId: '00000000-0000-0000-0000-000000000030',
        patientId: '00000000-0000-0000-0000-000000000040',
      }),
    ).rejects.toThrow('gateway_routing_rule_scope_conflict');
  });
});
