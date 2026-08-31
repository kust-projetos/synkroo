/**
 * Unit tests for the Drizzle-backed follow-up service.
 */

import { executarAll, executarPostConsulta, executarLembretesRetorno, listarPendentes, listarRetornoPendentes } from '../followup-service';

const mockDb = { select: jest.fn() };

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb) }));

function query(result: unknown[]): any {
  const chain: any = {
    from: jest.fn(() => chain),
    innerJoin: jest.fn(() => chain),
    leftJoin: jest.fn(() => chain),
    where: jest.fn(() => Promise.resolve(result)),
  };
  return chain;
}

function setSelectResults(...results: unknown[][]) {
  let index = 0;
  mockDb.select.mockImplementation(() => query(results[index++] ?? []));
}

describe('followup-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.select.mockReset();
  });

  describe('executarAll', () => {
    it('returns the stable processed envelope when there is no pending work', async () => {
      setSelectResults([], []);
      const result = await executarAll('clinic-a');
      expect(result).toEqual({ processed: 1 });
    });
  });

  describe('executarPostConsulta', () => {
    it('returns post-consultation counters when there are no pending appointments', async () => {
      setSelectResults([]);
      const result = await executarPostConsulta('clinic-a');
      expect(result).toEqual({ processed: 0, sent: 0, failed: 0 });
    });
  });

  describe('executarLembretesRetorno', () => {
    it('returns return-reminder counters when there are no patients', async () => {
      setSelectResults([], []);
      const result = await executarLembretesRetorno('clinic-a');
      expect(result).toEqual({ processed: 0, sent: 0, failed: 0 });
    });
  });

  describe('listarPendentes', () => {
    it('filters appointments by clinicId', async () => {
      setSelectResults([
        { id: 'a1', updatedAt: new Date(), scheduledAt: new Date(), patientId: 'p1', patientName: 'A', patientPhone: '11999990000', dentistName: null, procedureName: null, clinicId: 'c1', clinicName: 'C1', clinicPhone: '111' },
        { id: 'a2', updatedAt: new Date(), scheduledAt: new Date(), patientId: 'p2', patientName: 'B', patientPhone: '11999990001', dentistName: null, procedureName: null, clinicId: 'c2', clinicName: 'C2', clinicPhone: '222' },
      ], []);
      const result = await listarPendentes('c1');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('returns empty when no appointments match clinic', async () => {
      setSelectResults([
        { id: 'a2', updatedAt: new Date(), scheduledAt: new Date(), patientId: 'p2', patientName: 'B', patientPhone: '11999990001', dentistName: null, procedureName: null, clinicId: 'c2', clinicName: 'C2', clinicPhone: '222' },
      ], []);
      const result = await listarPendentes('c1');
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('listarRetornoPendentes', () => {
    it('filters return-reminder patients by clinicId', async () => {
      setSelectResults([
        { id: 'p1', name: 'A', phone: '11999990000', lastVisit: new Date(), optOutReminders: false, clinicId: 'c1', clinicName: 'C1', clinicPhone: '111' },
        { id: 'p2', name: 'B', phone: '11999990001', lastVisit: new Date(), optOutReminders: false, clinicId: 'c2', clinicName: 'C2', clinicPhone: '222' },
      ], []);
      const result = await listarRetornoPendentes('c1');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
