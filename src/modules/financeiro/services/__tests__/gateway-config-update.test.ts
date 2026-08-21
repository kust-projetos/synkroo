const mockUpdateRoutingRule = jest.fn();
const mockCreateRoutingRule = jest.fn();

jest.mock('../../repositories/financeiro-repository', () => ({
  assertSingleRoutingScope: (scope: { campaignId?: string; patientId?: string; leadId?: string }) => {
    if ([scope.campaignId, scope.patientId, scope.leadId].filter(Boolean).length !== 1) {
      throw new Error('gateway_routing_rule_scope_conflict');
    }
  },
  createRoutingRule: (...args: unknown[]) => mockCreateRoutingRule(...args),
  updateRoutingRule: (...args: unknown[]) => mockUpdateRoutingRule(...args),
  listRoutingRules: jest.fn(),
  createPaymentGateway: jest.fn(),
  getPaymentGateway: jest.fn(),
  updatePaymentGateway: jest.fn(),
  listGateways: jest.fn(),
}));

import { saveRoutingRule } from '../gateway-config-service';

const input = {
  clinicId: 'clinic-1',
  id: 'rule-1',
  gatewayId: 'gateway-2',
  patientId: 'patient-1',
};

describe('saveRoutingRule update', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates an existing rule within the clinic', async () => {
    const updated = { ...input, campaignId: null, leadId: null };
    mockUpdateRoutingRule.mockResolvedValue(updated);

    await expect(saveRoutingRule(input)).resolves.toEqual(updated);
    expect(mockUpdateRoutingRule).toHaveBeenCalledWith('rule-1', 'clinic-1', {
      gatewayId: 'gateway-2', campaignId: null, patientId: 'patient-1', leadId: null,
    });
  });

  it('rejects a rule missing from the clinic scope', async () => {
    mockUpdateRoutingRule.mockResolvedValue(undefined);
    await expect(saveRoutingRule(input)).rejects.toThrow('Routing rule not found');
  });
});
