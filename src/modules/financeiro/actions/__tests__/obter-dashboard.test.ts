/**
 * SYNK-IMPL-FLOATS — obterDashboard: soma de inadimplência em centavos exatos.
 *
 * listOverdueCharges é mockado; enrichOverdueCharges real classifica o estágio.
 */

import type { ActionContext } from '@/core/actions/types';
import { runAction } from '@/core/actions/run';
import { obterDashboard } from '../obter-dashboard';
import { listOverdueCharges } from '../../services/collection-service';

jest.mock('../../services/collection-service', () => ({
  ...jest.requireActual('../../services/collection-service'),
  listOverdueCharges: jest.fn(),
}));

const mockedListOverdue = listOverdueCharges as jest.Mock;

const ctx: ActionContext = {
  source: 'user',
  clinicId: '00000000-0000-0000-0000-000000000001',
  user: { id: 'user-1', email: 'user@example.test', name: 'User' },
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'user-1' },
};

function charge(amount: string, daysAgo: number): any {
  return {
    id: `charge-${amount}-${daysAgo}`,
    clinicId: ctx.clinicId,
    budgetId: 'budget-1',
    gatewayId: 'gateway-1',
    amount,
    dueDate: new Date(Date.now() - daysAgo * 86400000),
    status: 'pending',
  };
}

beforeEach(() => jest.clearAllMocks());

describe('obterDashboard — precisão monetária', () => {
  it('0.10 + 0.20 soma exatamente 0.30 (sem 0.30000000000000004)', async () => {
    mockedListOverdue.mockResolvedValue([charge('0.10', 5), charge('0.20', 2)]);

    const res = await runAction(obterDashboard, {}, ctx);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.overdueCount).toBe(2);
    expect(res.data.totalOverdue).toBe(0.3);
  });

  it('retorna zero sem inadimplência', async () => {
    mockedListOverdue.mockResolvedValue([]);

    const res = await runAction(obterDashboard, {}, ctx);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.overdueCount).toBe(0);
    expect(res.data.totalOverdue).toBe(0);
  });
});
