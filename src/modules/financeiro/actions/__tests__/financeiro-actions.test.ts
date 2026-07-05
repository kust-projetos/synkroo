/**
 * Unit tests: Financeiro actions (Task 4).
 *
 * Tests action-level validation rules and service helpers.
 */

import { criarOrcamento } from '../criar-orcamento';
import { renderRatio } from '../../services/dashboard-service';

test('criarOrcamento requires exactly patientId or leadId', async () => {
  // Both patientId and leadId → should reject
  await expect(
    criarOrcamento.input.parseAsync({
      clinicId: '00000000-0000-0000-0000-000000000001',
      patientId: '00000000-0000-0000-0000-000000000002',
      leadId: '00000000-0000-0000-0000-000000000003',
      items: [{ procedureName: 'Limpeza', quantity: 1, unitPrice: 150 }],
    }),
  ).rejects.toBeTruthy();
});

test('criarOrcamento accepts only patientId', async () => {
  const parsed = await criarOrcamento.input.parseAsync({
    clinicId: '00000000-0000-0000-0000-000000000001',
    patientId: '00000000-0000-0000-0000-000000000002',
    items: [{ procedureName: 'Limpeza', quantity: 1, unitPrice: 150 }],
  });
  expect(parsed.patientId).toBe('00000000-0000-0000-0000-000000000002');
  expect(parsed.leadId).toBeUndefined();
});

test('criarOrcamento accepts only leadId', async () => {
  const parsed = await criarOrcamento.input.parseAsync({
    clinicId: '00000000-0000-0000-0000-000000000001',
    leadId: '00000000-0000-0000-0000-000000000003',
    items: [{ procedureName: 'Limpeza', quantity: 1, unitPrice: 150 }],
  });
  expect(parsed.leadId).toBe('00000000-0000-0000-0000-000000000003');
  expect(parsed.patientId).toBeUndefined();
});

test('dashboard null ratios render as dash', () => {
  expect(renderRatio(null)).toBe('—');
});

test('dashboard ratio with value formats correctly', () => {
  expect(renderRatio(0.75)).toBe('75%');
  expect(renderRatio(0)).toBe('0%');
  expect(renderRatio(1)).toBe('100%');
});
