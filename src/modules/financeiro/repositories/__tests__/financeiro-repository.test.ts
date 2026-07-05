import { assertSingleRoutingScope, buildChargeInsert } from '../financeiro-repository';

test('routing rule accepts exactly one scope', () => {
  expect(() => assertSingleRoutingScope({ campaignId: 'ca1', patientId: 'p1' })).toThrow('gateway_routing_rule_scope_conflict');
  expect(() => assertSingleRoutingScope({ leadId: 'l1' })).not.toThrow();
});

test('charge insert keeps tenant fields', () => {
  expect(buildChargeInsert({ clinicId: 'c1', budgetId: 'b1', gatewayId: 'g1', amount: 100, dueDate: '2026-07-10' }))
    .toMatchObject({ clinicId: 'c1', budgetId: 'b1', gatewayId: 'g1', status: 'pending' });
});
