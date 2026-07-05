/**
 * Integration tests: Financeiro actions (Task 4 rework).
 *
 * Tests REAL execution of actions/services against the in-memory store.
 * No 'Not yet implemented' stubs should throw.
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
import { createBudget, calculateBudgetTotals } from '../../services/budget-service';
import { createCharge, cancelCharge, listOverdueCharges } from '../../services/charge-service';
import { saveGateway, saveRoutingRule, maskApiKey } from '../../services/gateway-config-service';

// Helper UUIDs for testing
const CLINIC_ID = '00000000-0000-0000-0000-000000000001';
const PATIENT_ID = '00000000-0000-0000-0000-000000000010';
const LEAD_ID = '00000000-0000-0000-0000-000000000011';
const OTHER_CLINIC_ID = '00000000-0000-0000-0000-000000000099';

beforeEach(() => {
  storeReset();
});

// ══════════════════════════════════════════════
// criarOrcamento
// ══════════════════════════════════════════════

describe('criarOrcamento', () => {
  test('executes and returns created budget with deterministic totals', async () => {
    const budget = await createBudget({
      clinicId: CLINIC_ID,
      patientId: PATIENT_ID,
      items: [
        { procedureName: 'Limpeza', quantity: 1, unitPrice: 150 },
        { procedureName: 'Clareamento', quantity: 1, unitPrice: 800 },
      ],
      discountPercent: 10,
    });

    expect(budget).toBeDefined();
    expect(budget.id).toBeTruthy();
    expect(budget.clinicId).toBe(CLINIC_ID);
    expect(budget.patientId).toBe(PATIENT_ID);
    expect(budget.status).toBe('pending');
    // totalValue = 150 + 800 = 950
    expect(budget.totalValue).toBe('950');
    // discountValue = 950 * 0.1 = 95
    expect(budget.discountValue).toBe('95');
    // finalValue = 950 - 95 = 855
    expect(budget.finalValue).toBe('855');
    expect(budget.items).toHaveLength(2);
  });

  test('requires exactly one of patientId or leadId (Zod refine)', async () => {
    // Both → reject
    await expect(
      criarOrcamento.input.parseAsync({
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        leadId: LEAD_ID,
        items: [{ procedureName: 'Teste', quantity: 1, unitPrice: 100 }],
      }),
    ).rejects.toBeTruthy();

    // Neither → reject
    await expect(
      criarOrcamento.input.parseAsync({
        clinicId: CLINIC_ID,
        items: [{ procedureName: 'Teste', quantity: 1, unitPrice: 100 }],
      }),
    ).rejects.toBeTruthy();

    // Only patientId → accept
    const parsed = await criarOrcamento.input.parseAsync({
      clinicId: CLINIC_ID,
      patientId: PATIENT_ID,
      items: [{ procedureName: 'Teste', quantity: 1, unitPrice: 100 }],
    });
    expect(parsed.patientId).toBe(PATIENT_ID);
    expect(parsed.leadId).toBeUndefined();
  });

  test('creates budget with leadId', async () => {
    const budget = await createBudget({
      clinicId: CLINIC_ID,
      leadId: LEAD_ID,
      items: [{ procedureName: 'Teste', quantity: 1, unitPrice: 100 }],
    });

    expect(budget.leadId).toBe(LEAD_ID);
    expect(budget.patientId).toBeNull();
  });

  test('calculateBudgetTotals is deterministic', () => {
    const result = calculateBudgetTotals([
      { procedureName: 'A', quantity: 2, unitPrice: 50 },
      { procedureName: 'B', quantity: 1, unitPrice: 200 },
    ], 10);

    expect(result.totalValue).toBe(300); // 100 + 200
    expect(result.discountPercent).toBe(10);
    expect(result.discountValue).toBe(30); // 300 * 0.1
    expect(result.finalValue).toBe(270); // 300 - 30
  });
});

// ══════════════════════════════════════════════
// aceitarOrcamento
// ══════════════════════════════════════════════

describe('aceitarOrcamento', () => {
  test('accepts budget with patientId', async () => {
    const budget = await createBudget({
      clinicId: CLINIC_ID,
      patientId: PATIENT_ID,
      items: [{ procedureName: 'Teste', quantity: 1, unitPrice: 100 }],
    });

    const accepted = await aceitarOrcamento.handler(
      { clinicId: CLINIC_ID, id: budget.id },
      {} as any,
    );

    expect(accepted.status).toBe('accepted');
    expect(accepted.acceptedAt).toBeTruthy();
  });

  test('rejects budget from wrong clinic', async () => {
    const budget = await createBudget({
      clinicId: CLINIC_ID,
      patientId: PATIENT_ID,
      items: [{ procedureName: 'Teste', quantity: 1, unitPrice: 100 }],
    });

    await expect(
      aceitarOrcamento.handler(
        { clinicId: OTHER_CLINIC_ID, id: budget.id },
        {} as any,
      ),
    ).rejects.toThrow('Budget not found');
  });
});

// ══════════════════════════════════════════════
// gerarCobranca + cancelarCobranca
// ══════════════════════════════════════════════

describe('gerarCobranca', () => {
  test('generates charge resolving gateway routing', async () => {
    // Setup: create a budget and a default gateway
    const budget = await createBudget({
      clinicId: CLINIC_ID,
      patientId: PATIENT_ID,
      items: [{ procedureName: 'Teste', quantity: 1, unitPrice: 500 }],
    });

    // Save a default gateway
    await saveGateway({
      clinicId: CLINIC_ID,
      provider: 'asaas',
      isDefault: true,
      isEnabled: true,
      apiKey: 'asaas_api_key_test_12345',
    });

    const result = await gerarCobranca.handler(
      {
        clinicId: CLINIC_ID,
        budgetId: budget.id,
        dueDate: '2026-08-15',
        amount: 500,
      },
      {} as any,
    );

    expect(result.charge).toBeDefined();
    expect(result.charge.budgetId).toBe(budget.id);
    expect(result.charge.status).toBe('pending');
    expect(result.charge.amount).toBe('500');
    // Gateway is registered (mock asaasClient exists) or we get simulated response
    expect(result.paymentUrl).toBeTruthy();
  });

  test('throws when no gateway configured', async () => {
    const budget = await createBudget({
      clinicId: CLINIC_ID,
      patientId: PATIENT_ID,
      items: [{ procedureName: 'Teste', quantity: 1, unitPrice: 500 }],
    });

    await expect(
      gerarCobranca.handler(
        {
          clinicId: CLINIC_ID,
          budgetId: budget.id,
          dueDate: '2026-08-15',
          amount: 500,
        },
        {} as any,
      ),
    ).rejects.toThrow('No enabled default gateway found');
  });
});

describe('cancelarCobranca', () => {
  test('cancels open charge', async () => {
    const budget = await createBudget({
      clinicId: CLINIC_ID,
      patientId: PATIENT_ID,
      items: [{ procedureName: 'Teste', quantity: 1, unitPrice: 500 }],
    });

    await saveGateway({
      clinicId: CLINIC_ID,
      provider: 'asaas',
      isDefault: true,
      isEnabled: true,
    });

    const generated = await gerarCobranca.handler(
      { clinicId: CLINIC_ID, budgetId: budget.id, dueDate: '2026-08-15', amount: 500 },
      {} as any,
    );

    const result = await cancelarCobranca.handler(
      { clinicId: CLINIC_ID, id: generated.charge.id },
      {} as any,
    );

    expect(result.cancelled).toBe(true);
    expect(result.charge.status).toBe('cancelled');
  });

  test('no-op for settled charge', async () => {
    // Setup: create a budget and a default gateway
    const budget = await createBudget({
      clinicId: CLINIC_ID,
      patientId: PATIENT_ID,
      items: [{ procedureName: 'Teste', quantity: 1, unitPrice: 500 }],
    });

    await saveGateway({
      clinicId: CLINIC_ID,
      provider: 'asaas',
      isDefault: true,
      isEnabled: true,
    });

    const result = await createCharge({
      clinicId: CLINIC_ID,
      budgetId: budget.id,
      amount: 500,
      dueDate: '2026-08-15',
    });

    // Manually mark as paid to simulate settled charge
    const { storeUpdateCharge } = await import('../../repositories/financeiro-store');
    storeUpdateCharge(result.charge.id, { status: 'paid', paidAt: new Date().toISOString() });

    const cancelResult = await cancelCharge({
      clinicId: CLINIC_ID,
      chargeId: result.charge.id,
    });

    // Should be no-op — charge stays paid
    expect(cancelResult.cancelled).toBe(false);
    expect(cancelResult.charge.status).toBe('paid');
  });
});

// ══════════════════════════════════════════════
// salvarGateway
// ══════════════════════════════════════════════

describe('salvarGateway', () => {
  test('masks API key and never returns raw secret', async () => {
    const safe = await saveGateway({
      clinicId: CLINIC_ID,
      provider: 'asaas',
      isDefault: true,
      isEnabled: true,
      apiKey: 'sk_live_abcdef1234567890',
    });

    expect(safe.id).toBeTruthy();
    expect(safe.provider).toBe('asaas');
    expect(safe.isDefault).toBe(true);
    expect(safe.isEnabled).toBe(true);
    // The safe response should NOT contain apiKey
    expect((safe as any).apiKey).toBeUndefined();
    // maskedLabel should show masked key (last 4 visible, rest asterisks)
    // 'sk_live_abcdef1234567890' length = 24, last 4 = '7890'
    expect(safe.maskedLabel).toBe('********************7890');
  });

  test('maskApiKey works correctly', () => {
    // 'abc123' length = 6, last 4 = 'c123', so 2 asterisks + 'c123'
    expect(maskApiKey('abc123')).toBe('**c123');
    // 'sk_live_abcdef1234567890' length = 24, last 4 = '7890', so 20 asterisks + '7890'
    expect(maskApiKey('sk_live_abcdef1234567890')).toBe('********************7890');
    // short key uses full mask
    expect(maskApiKey('ab')).toBe('****');
  });
});

// ══════════════════════════════════════════════
// salvarRegraRoteamento
// ══════════════════════════════════════════════

describe('salvarRegraRoteamento', () => {
  const GATEWAY_ID = '00000000-0000-0000-0000-000000000020';

  test('validates single scope via Zod refine', async () => {
    // Two scopes → reject
    await expect(
      salvarRegraRoteamento.input.parseAsync({
        clinicId: CLINIC_ID,
        gatewayId: GATEWAY_ID,
        campaignId: '00000000-0000-0000-0000-000000000030',
        patientId: '00000000-0000-0000-0000-000000000040',
      }),
    ).rejects.toBeTruthy();

    // Zero scopes → reject
    await expect(
      salvarRegraRoteamento.input.parseAsync({
        clinicId: CLINIC_ID,
        gatewayId: GATEWAY_ID,
      }),
    ).rejects.toBeTruthy();
  });

  test('enforces single scope in real execution', async () => {
    // Valid: only campaignId
    const rule = await saveRoutingRule({
      clinicId: CLINIC_ID,
      gatewayId: GATEWAY_ID,
      campaignId: '00000000-0000-0000-0000-000000000030',
    });

    expect(rule.campaignId).toBe('00000000-0000-0000-0000-000000000030');
    expect(rule.patientId).toBeNull();
    expect(rule.leadId).toBeNull();
  });

  test('throws via assertSingleRoutingScope when multiple scopes provided', async () => {
    await expect(
      saveRoutingRule({
        clinicId: CLINIC_ID,
        gatewayId: GATEWAY_ID,
        campaignId: '00000000-0000-0000-0000-000000000030',
        patientId: '00000000-0000-0000-0000-000000000040',
      }),
    ).rejects.toThrow('gateway_routing_rule_scope_conflict');
  });
});

// ══════════════════════════════════════════════
// listarCobrancasAtrasadas
// ══════════════════════════════════════════════

describe('listarCobrancasAtrasadas', () => {
  test('returns overdue charges with collection stages', async () => {
    // Create a charge with past due date
    const budget = await createBudget({
      clinicId: CLINIC_ID,
      patientId: PATIENT_ID,
      items: [{ procedureName: 'Teste', quantity: 1, unitPrice: 500 }],
    });

    await saveGateway({
      clinicId: CLINIC_ID,
      provider: 'asaas',
      isDefault: true,
      isEnabled: true,
    });

    // Create a charge with a due date in the past
    await createCharge({
      clinicId: CLINIC_ID,
      budgetId: budget.id,
      amount: 500,
      dueDate: '2025-01-01', // far past → should be overdue
    });

    const result = await listarCobrancasAtrasadas.handler(
      { clinicId: CLINIC_ID, page: 1, limit: 50 },
      {} as any,
    );

    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
    // Should have collection stages
    expect(result.data[0].daysOverdue).toBeGreaterThan(0);
    // More than 7 days → internal stage
    expect(result.data[0].collectionStage).toBe('internal');
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
