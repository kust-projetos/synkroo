/**
 * Focused test for the listar-leads-quentes action — locks the
 * "hot lead" filter behavior so the typecheck-driven typing fix to
 * the callback parameter does not regress the predicate.
 */
jest.mock('@/modules/comercial/repositories/leads-repository', () => ({
  listLeadsByClinic: jest.fn(),
}));

import { listLeadsByClinic } from '@/modules/comercial/repositories/leads-repository';
import { listarLeadsQuentes } from '@/modules/comercial/actions/listar-leads-quentes';

const baseLeads = [
  { id: 'hot-1', name: 'Hot A', temperature: 'hot', score: 80, status: 'novo' },
  { id: 'hot-2', name: 'Hot B', temperature: 'hot', score: 70, status: 'contato' },
  { id: 'warm-1', name: 'Warm', temperature: 'warm', score: 90, status: 'novo' },
  { id: 'hot-low', name: 'Hot low', temperature: 'hot', score: 50, status: 'novo' },
  { id: 'hot-converted', name: 'Hot converted', temperature: 'hot', score: 90, status: 'converted' },
  { id: 'hot-lost', name: 'Hot lost', temperature: 'hot', score: 90, status: 'lost' },
];

describe('listarLeadsQuentes action — hot-lead filter', () => {
  beforeEach(() => {
    (listLeadsByClinic as jest.Mock).mockReset();
  });

  it('returns only hot leads with score >= 70 that are not converted or lost', async () => {
    (listLeadsByClinic as jest.Mock).mockResolvedValue(baseLeads);

    const result = await (listarLeadsQuentes.handler as any)({}, {
      clinicId: 'c1',
    });

    const ids = result.leads.map((l: any) => l.id);
    expect(ids).toEqual(['hot-1', 'hot-2']);
  });

  it('honors the limit input', async () => {
    (listLeadsByClinic as jest.Mock).mockResolvedValue(baseLeads);

    const result = await (listarLeadsQuentes.handler as any)({ limit: 1 }, {
      clinicId: 'c1',
    });

    expect(result.leads).toHaveLength(1);
    expect(result.leads[0].id).toBe('hot-1');
  });

  it('returns an empty list when no lead matches the hot criteria', async () => {
    (listLeadsByClinic as jest.Mock).mockResolvedValue([baseLeads[2]]);

    const result = await (listarLeadsQuentes.handler as any)({}, {
      clinicId: 'c1',
    });

    expect(result.leads).toEqual([]);
  });
});