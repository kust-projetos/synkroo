/**
 * Unit tests for the Drizzle-backed inactive patient service.
 */

import {
  calculateDaysSinceLastVisit,
  findInactivePatients,
  getInactivitySegment,
  INACTIVITY_SEGMENTS,
  reactivatePatient,
  runInactivityDetection,
} from '../inactive-service';
import { PgDialect } from 'drizzle-orm/pg-core';

const mockDb: { select: jest.Mock; update: jest.Mock } = {
  select: jest.fn(),
  update: jest.fn(() => ({
    set: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([])) })),
  })),
};

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb) }));

function query(result: unknown[], terminal: 'where' | 'orderBy'): any {
  const chain: any = {
    from: jest.fn(() => chain),
    leftJoin: jest.fn(() => chain),
    where: jest.fn(() => terminal === 'where' ? Promise.resolve(result) : chain),
    orderBy: jest.fn(() => terminal === 'orderBy' ? Promise.resolve(result) : chain),
  };
  return chain;
}

describe('inactive-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.update.mockReset();
    mockDb.update.mockImplementation(() => ({
      set: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([])) })),
    }));
  });

  describe('INACTIVITY_SEGMENTS', () => {
    it('is defined and non-empty', () => {
      expect(INACTIVITY_SEGMENTS).toBeDefined();
      expect(INACTIVITY_SEGMENTS.length).toBeGreaterThan(0);
    });
  });

  describe('segment helpers', () => {
    it('calculates missing visits as highly inactive and rejects out-of-range segments', () => {
      expect(calculateDaysSinceLastVisit(null)).toBe(999);
      expect(getInactivitySegment(45)?.segment).toBe('inactive_30');
      expect(getInactivitySegment(10)).toBeNull();
    });
  });

  describe('runInactivityDetection', () => {
    it('updates tags for inactive patients in the requested clinic', async () => {
      mockDb.select
        .mockReturnValueOnce(query([
          { id: 'p1', name: 'Paciente A', phone: '11999990000', lastVisitAt: null, riskScore: '0', clinicId: 'clinic-a' },
        ], 'where'))
        .mockReturnValueOnce(query([{ name: 'Clinic A' }], 'where'))
        .mockReturnValueOnce(query([], 'orderBy'))
        .mockReturnValueOnce(query([{ tags: ['VIP', 'Inativo 30 dias', 'inativo antigo'] }], 'where'));
      const result = await runInactivityDetection('clinic-a');
      expect(result).toMatchObject({ processed: 1, failed: 0, success: true, status: 'completed' });
      expect(result.errors).toEqual([]);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('counts a tag update error without aborting the batch', async () => {
      mockDb.select
        .mockReturnValueOnce(query([
          { id: 'p1', name: 'Paciente A', phone: '11999990000', lastVisitAt: null, riskScore: '0', clinicId: 'clinic-a' },
        ], 'where'))
        .mockReturnValueOnce(query([{ name: 'Clinic A' }], 'where'))
        .mockReturnValueOnce(query([], 'orderBy'))
        .mockReturnValueOnce(query([{ tags: [] }], 'where'));
      mockDb.update.mockImplementationOnce(() => {
        throw new Error('update failed');
      });

      const result = await runInactivityDetection('clinic-a');
      // Erro de batch não aborta nem é descartado: failed/errors explícitos, success:false.
      expect(result).toMatchObject({ processed: 0, failed: 1, success: false, status: 'failed' });
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('findInactivePatients', () => {
    it('finds inactive patients scoped to clinicId and minDays', async () => {
      mockDb.select
        .mockReturnValueOnce(query([
          { id: 'p1', name: 'Paciente A', phone: '11999990000', lastVisitAt: null, riskScore: '0', clinicId: 'c1' },
        ], 'where'))
        .mockReturnValueOnce(query([{ name: 'Clinic 1' }], 'where'))
        .mockReturnValueOnce(query([], 'orderBy'));
      const result = await findInactivePatients('c1', 30);
      expect(result).toHaveLength(1);
      expect(result[0].patientId).toBe('p1');
    });

    it('defaults minDays to 30', async () => {
      mockDb.select.mockReturnValueOnce(query([], 'where'));
      await expect(findInactivePatients('c1')).resolves.toEqual([]);
    });

    it('includes visits and sorts older segments before newer ones', async () => {
      const day = 86_400_000;
      mockDb.select
        .mockReturnValueOnce(query([
          { id: 'p1', name: 'Paciente 60', phone: '11999990001', lastVisitAt: new Date(Date.now() - 75 * day), riskScore: '0.40', clinicId: 'c1' },
          { id: 'p2', name: 'Paciente 30', phone: '11999990002', lastVisitAt: new Date(Date.now() - 35 * day), riskScore: '0.90', clinicId: 'c1' },
        ], 'where'))
        .mockReturnValueOnce(query([{ name: 'Clinic 1' }], 'where'))
        .mockReturnValueOnce(query([
          { patientId: 'p1', scheduledAt: new Date(), status: 'completed', procedureName: 'Limpeza' },
          { patientId: 'p2', scheduledAt: new Date(), status: 'confirmed', procedureName: null },
        ], 'orderBy'));

      const result = await findInactivePatients('c1');

      expect(result.map((patient) => patient.patientId)).toEqual(['p1', 'p2']);
      expect(result[0].lastProcedure).toBe('Limpeza');
      expect(result[0].totalVisits).toBe(1);
      expect(result[1].totalVisits).toBe(1);
    });

    it('returns an empty list when the database query fails', async () => {
      mockDb.select.mockImplementationOnce(() => {
        throw new Error('database unavailable');
      });

      await expect(findInactivePatients('c1')).resolves.toEqual([]);
    });

    it('usa borda inclusiva (<=) e tenant, coerente com INACTIVITY_SEGMENTS', async () => {
      const chain = query([], 'where');
      mockDb.select.mockReturnValueOnce(chain);

      await findInactivePatients('c1', 30);

      const predicate = chain.where.mock.calls[0][0];
      const { sql: rendered } = new PgDialect().sqlToQuery(predicate);

      // Exatamente no cutoff conta ("inativo há >= minDays") => lte, não lt.
      expect(rendered).toContain('<=');
      // Nenhum `<` puro (lt) sobre last_visit_at — só `<=`.
      expect(rendered).not.toMatch(/last_visit_at"\s*<(?!\=)/);
      expect(rendered).toContain('is null');
      expect(rendered).toContain('clinic_id');
    });
  });

  describe('reactivatePatient', () => {
    it('removes inactivity tags and resets the patient risk', async () => {
      mockDb.select.mockReturnValueOnce(query([{ id: 'p1', status: 'inactive', tags: ['VIP', 'Inativo 90 dias'] }], 'where'));
      mockDb.update.mockReturnValueOnce({
        set: jest.fn(() => ({
          where: jest.fn(() => ({ returning: jest.fn().mockResolvedValue([{ id: 'p1' }]) })),
        })),
      });

      await expect(reactivatePatient('c1', 'p1')).resolves.toEqual({ success: true });
    });

    it('is idempotent when already active without inactivity tags', async () => {
      mockDb.select.mockReturnValueOnce(query([{ id: 'p1', status: 'active', tags: ['VIP'] }], 'where'));

      await expect(reactivatePatient('c1', 'p1')).resolves.toEqual({ success: true, alreadyProcessed: true });
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('returns not_found when the patient is absent; concurrent reactivation is already_processed', async () => {
      mockDb.select.mockReturnValueOnce(query([], 'where'));
      await expect(reactivatePatient('c1', 'missing')).rejects.toMatchObject({ code: 'not_found' });

      mockDb.select.mockReturnValueOnce(query([{ id: 'p1', status: 'active', tags: ['Inativo 30 dias'] }], 'where'));
      mockDb.update.mockReturnValueOnce({
        set: jest.fn(() => ({
          where: jest.fn(() => ({ returning: jest.fn().mockResolvedValue([]) })),
        })),
      });
      // Linha existia no select e o update afetou 0 linhas = reativado por
      // outro worker entre as duas operações → idempotente explícito.
      await expect(reactivatePatient('c1', 'p1')).resolves.toEqual({ success: true, alreadyProcessed: true });
    });
  });
});
