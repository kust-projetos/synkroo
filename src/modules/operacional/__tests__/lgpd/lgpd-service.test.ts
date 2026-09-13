/**
 * T3 unit — LGPD export minimization and queue redaction fail-closed
 */
import { ActionError } from '@/core/actions/types';

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(),
  closeDb: jest.fn(),
}));

jest.mock('../../services/lgpd-registry', () => ({
  getLGPDContributions: jest.fn(() => []),
}));

import { getDb } from '@/lib/db/client';
import { exportPatientData, anonymizePatient } from '../../services/lgpd-service';
import { getLGPDContributions } from '../../services/lgpd-registry';
import * as dbClient from '@/lib/db/client';

// Helper to create a mock DB transaction that simulates loadPatientGraph queries
function createMockTx(overrides: {
  patients?: any[];
  appointments?: any[];
  actionLogs?: any[];
  auditLogs?: any[];
  executeImpl?: (sql: any) => any;
}) {
  const patients = [{ id: 'patient-a', clinicId: 'clinic-1', name: 'A', phone: '111', email: 'a@test', cpf: '111', birthDate: '1990-01-01' }];
  const actionLogs = overrides.actionLogs ?? [];
  const auditLogs = overrides.auditLogs ?? [];

  // Mock for db.select().from().where() chain
  const mockSelect = jest.fn((..._args: any[]) => ({
    from: jest.fn((table: any) => {
      // Detect table by reference check via stringified name or by checking known tables
      // We use a simple heuristic: if table has 'action_logs' or we compare via imported table
      // For unit test we will just handle based on call order, but better to check table identity
      // Import tables to compare
      const { patients: patientsTable } = require('../../schema/patients');
      const { actionLogs: actionLogsTable } = require('@/lib/db/schema/audit');
      const { auditLogs: auditLogsTable } = require('@/core/schema/infra');

      // Determine which table is being queried
      let data: any[] = [];
      let isActionLogs = false;
      let isAuditLogs = false;
      let isPatients = false;

      // Compare by reference (if table is the same object)
      try {
        if (table === patientsTable) isPatients = true;
        if (table === actionLogsTable) isActionLogs = true;
        if (table === auditLogsTable) isAuditLogs = true;
      } catch {}

      // Fallback by table name string
      const tableName = (table as any)?.name || (table as any)?.tableName || '';
      if (tableName.includes('action_logs')) isActionLogs = true;
      if (tableName.includes('audit_logs')) isAuditLogs = true;
      if (tableName.includes('patients')) isPatients = true;

      if (isPatients) data = patients;
      else if (isActionLogs) data = actionLogs;
      else if (isAuditLogs) data = auditLogs;
      else data = overrides.appointments ?? [];

      const whereResult: any = Promise.resolve(data);
      whereResult.limit = jest.fn(() => Promise.resolve(data));
      whereResult.where = jest.fn(() => whereResult);
      return {
        where: jest.fn(() => whereResult),
      };
    }),
  }));

  // For simplicity, handle all selects via from().where() chain that returns data as above
  // But loadPatientGraph also does selectByIds for treatmentPlanItems etc — we can return empty for those
  const mockDb: any = {
    select: mockSelect,
    execute: overrides.executeImpl || jest.fn().mockResolvedValue({ rows: [] }),
    transaction: jest.fn(async (cb: any) => cb(mockDb)),
  };

  // Also need to handle direct db.select().from().where().limit() for patients
  // Our mockSelect already handles, but we need to ensure transaction works
  mockDb.transaction = jest.fn(async (cb: any) => {
    // For exportPatientData, transaction is called with (tx) => loadPatientGraph(tx, ...)
    // loadPatientGraph will use tx.select etc.
    return cb(mockDb);
  });

  return mockDb;
}

describe('T3 — exportPatientData actionLogs minimization (same clinic)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('export A does not contain identifiers/payload/actions of B in same clinic', async () => {
    const clinicId = 'clinic-1';
    const patientA = 'patient-a';
    const patientB = 'patient-b';

    const logA = { id: 'log-a', clinicId, actionName: 'view_patient', inputRedacted: { patientId: patientA, notes: 'A notes' }, result: 'ok' };
    const logB = { id: 'log-b', clinicId, actionName: 'view_patient', inputRedacted: { patientId: patientB, notes: 'B notes' }, result: 'ok' };
    const logUnrelated = { id: 'log-c', clinicId, actionName: 'view_patient', inputRedacted: { patientId: 'unrelated' }, result: 'ok' };

    const mockDb = createMockTx({
      patients: [{ id: patientA, clinicId, name: 'Patient A', phone: '111', email: 'a@test', cpf: '111', birthDate: '1990-01-01' }],
      actionLogs: [logA, logB, logUnrelated],
      auditLogs: [],
    });

    // Mock patients table response for loadPatientGraph's first query
    // We need to make the mock more precise: override select to return patientA for patients table
    const { patients: patientsTable } = await import('../../schema/patients');
    const { actionLogs: actionLogsTable } = await import('@/lib/db/schema/audit');

    // Create a more precise mock that distinguishes tables
    const preciseMockDb: any = {
      select: jest.fn((fields?: any) => ({
        from: jest.fn((table: any) => {
          const isPatients = table === patientsTable;
          const isActionLogs = table === actionLogsTable;
          let data: any[] = [];
          if (isPatients) data = [{ id: patientA, clinicId, name: 'Patient A', phone: '111', email: 'a@test', cpf: '111', birthDate: '1990-01-01' }];
          else if (isActionLogs) data = [logA, logB, logUnrelated];
          else if (table && (table as any).name === 'audit_logs') data = [];
          else data = [];

          const whereChain: any = {
            where: jest.fn(() => whereChain),
            limit: jest.fn(() => Promise.resolve(data)),
            then: (resolve: any) => resolve(data),
          };
          // Make whereChain thenable
          whereChain[Symbol.toStringTag] = 'Promise';
          const promise = Promise.resolve(data) as any;
          promise.limit = jest.fn(() => Promise.resolve(data));
          promise.where = jest.fn(() => promise);
          // Actually where should return an object that when awaited gives data
          return {
            where: jest.fn(() => {
              const p: any = Promise.resolve(data);
              p.limit = jest.fn(() => Promise.resolve(data));
              return p;
            }),
          };
        }),
      })),
      execute: jest.fn().mockResolvedValue({ rows: [] }),
      transaction: jest.fn(async (cb: any) => cb(preciseMockDb)),
    };
    // Patch transaction to return preciseMockDb
    preciseMockDb.transaction = jest.fn(async (cb: any) => cb(preciseMockDb));
    (getDb as jest.Mock).mockReturnValue(preciseMockDb);
    (getLGPDContributions as jest.Mock).mockReturnValue([]);

    // We need a simpler approach: mock the whole loadPatientGraph via overriding getDb to return filtered logs
    // Instead, we will test the filtering logic directly by mocking the DB to return all logs and then checking export filtering
    // For this unit test, we will directly call exportPatientData and verify that B's log is not in result

    // Mock getDb to return a DB that will make loadPatientGraph return filtered logs via our fixed code
    // We need to make actionLogs query return all logs, but our code will filter to only those containing patient-a
    // So we set up mock that returns all logs for actionLogs query
    const mockAllLogsDb: any = {
      select: jest.fn().mockImplementation(() => ({
        from: jest.fn().mockImplementation((table: any) => {
          // Determine table by checking if it's patients or actionLogs
          // Use string comparison as fallback
          const tableStr = String(table);
          const isPatientsTable = table === patientsTable;
          const isActionLogsTable = table === actionLogsTable;

          let data: any[] = [];
          if (isPatientsTable) {
            data = [{ id: patientA, clinicId, name: 'Patient A', phone: '111', email: 'a@test', cpf: '111', birthDate: '1990-01-01' }];
          } else if (isActionLogsTable) {
            data = [logA, logB, logUnrelated];
          } else {
            // For other tables (appointments etc), return empty to avoid unrelated data
            data = [];
          }

          return {
            where: jest.fn(() => {
              const p: any = Promise.resolve(data);
              p.limit = jest.fn(() => Promise.resolve(data.slice(0, 1)));
              // For auditLogs with inArray, we need to handle that too - return empty
              if (isActionLogsTable) {
                // For actionLogs, where is called with eq(clinicId) — we return all, filtering happens in code
                return p;
              }
              return p;
            }),
          };
        }),
      })),
      execute: jest.fn().mockResolvedValue({ rows: [] }),
      transaction: jest.fn(),
    };
    mockAllLogsDb.transaction = jest.fn(async (cb: any) => cb(mockAllLogsDb));
    (getDb as jest.Mock).mockReturnValue(mockAllLogsDb);

    const result = await exportPatientData(clinicId, patientA);

    // Verify that result does not contain B's identifiers
    const json = JSON.stringify(result);
    expect(json).not.toContain(patientB);
    expect(json).not.toContain('B notes');
    // Should contain A's log
    expect(json).toContain(patientA);
    // Should not contain unrelated patient
    expect(json).not.toContain('unrelated');
    // actionLogs should be filtered to only those containing patientA
    expect(result.actionLogs).toHaveLength(1);
    expect((result.actionLogs[0] as any).id).toBe('log-a');
  });

  it('omits actionLogs when no verifiable link exists (never exports whole clinic)', async () => {
    const clinicId = 'clinic-1';
    const patientA = 'patient-a';
    const logNoLink = { id: 'log-x', clinicId, actionName: 'view_dashboard', inputRedacted: { dashboard: 'stats' }, result: 'ok' };

    const { patients: patientsTable } = await import('../../schema/patients');
    const { actionLogs: actionLogsTable } = await import('@/lib/db/schema/audit');

    const mockDb: any = {
      select: jest.fn().mockImplementation(() => ({
        from: jest.fn().mockImplementation((table: any) => {
          let data: any[] = [];
          if (table === patientsTable) data = [{ id: patientA, clinicId, name: 'Patient A', phone: '111', email: 'a@test', cpf: '111', birthDate: '1990-01-01' }];
          else if (table === actionLogsTable) data = [logNoLink];
          else data = [];
          return {
            where: jest.fn(() => {
              const p: any = Promise.resolve(data);
              p.limit = jest.fn(() => Promise.resolve(data.slice(0, 1)));
              return p;
            }),
          };
        }),
      })),
      execute: jest.fn().mockResolvedValue({ rows: [] }),
      transaction: jest.fn(async (cb: any) => cb(mockDb)),
    };
    mockDb.transaction = jest.fn(async (cb: any) => cb(mockDb));
    (getDb as jest.Mock).mockReturnValue(mockDb);
    (getLGPDContributions as jest.Mock).mockReturnValue([]);

    const result = await exportPatientData(clinicId, patientA);
    expect(result.actionLogs).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain('view_dashboard');
  });
});

describe('T3 — redactAgentQueues fail-closed', () => {
  beforeEach(() => jest.clearAllMocks());

  it('failure to redact does not expose raw queue (throws, transaction rolls back)', async () => {
    const clinicId = 'clinic-1';
    const patientId = 'patient-a';

    const patientData = [{ id: patientId, clinicId, name: 'Test', phone: '111', email: 'a@test', cpf: '111', birthDate: '1990-01-01', legalHold: false }];
    const { patients: patientsTable } = await import('../../schema/patients');
    const createWhereResult = (data: any[]) => {
      const limitResult: any = Promise.resolve(data);
      limitResult.for = jest.fn(() => Promise.resolve(data));
      const whereResult: any = Promise.resolve(data);
      whereResult.limit = jest.fn(() => limitResult);
      return whereResult;
    };

    const mockDb: any = {
      select: jest.fn().mockImplementation(() => ({
        from: jest.fn().mockImplementation((table: any) => {
          const isPatients = table === patientsTable;
          const data = isPatients ? patientData : [];
          return { where: jest.fn(() => createWhereResult(data)) };
        }),
      })),
      execute: jest.fn().mockImplementation(() => Promise.reject(new Error('connection failure during redaction'))),
      transaction: jest.fn(),
      // For anonymize, transaction is called with async (tx) => { ... }
    };

    // Mock the transaction to call the callback and simulate the behavior of redactAgentQueues throwing
    mockDb.transaction = jest.fn(async (cb: any) => {
      // The callback will call loadPatientGraph and then redactAgentQueues
      // We need to make loadPatientGraph succeed but redactAgentQueues fail
      // To simplify, we mock the inner select for loadPatientGraph to succeed and then make execute fail
      return cb(mockDb);
    });

    // Need to mock loadPatientGraph's dependencies: patients, appointments etc — we already handle select
    // But redactAgentQueues will be called with relatedIds and will call db.execute which we make to reject
    // That should cause anonymizePatient to throw

    // Mock getLGPDContributions to return empty
    (getLGPDContributions as jest.Mock).mockReturnValue([]);
    (getDb as jest.Mock).mockReturnValue(mockDb);

    // Mock other DB calls for anonymize: update, insert, etc.
    // For simplicity, make all other DB operations succeed except execute for agent_queue
    mockDb.update = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    });
    mockDb.delete = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    });
    mockDb.insert = jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 'audit-1' }]),
      }),
    });

    await expect(anonymizePatient(clinicId, patientId, 'user-1')).rejects.toThrow(/Falha ao redigir filas do agente/);
  });

  it('safe omission when tables do not exist does not throw (unit test mode)', async () => {
    const clinicId = 'clinic-1';
    const patientId = 'patient-a';

    const patientData = [{ id: patientId, clinicId, name: 'Test', phone: '111', email: 'a@test', cpf: '111', birthDate: '1990-01-01', legalHold: false }];
    const { patients: patientsTable } = await import('../../schema/patients');
    const createWhereResult = (data: any[]) => {
      const limitResult: any = Promise.resolve(data);
      limitResult.for = jest.fn(() => Promise.resolve(data));
      const whereResult: any = Promise.resolve(data);
      whereResult.limit = jest.fn(() => limitResult);
      return whereResult;
    };

    const mockDb: any = {
      select: jest.fn().mockImplementation(() => ({
        from: jest.fn().mockImplementation((table: any) => {
          const isPatients = table === patientsTable;
          const data = isPatients ? patientData : [];
          return { where: jest.fn(() => createWhereResult(data)) };
        }),
      })),
      execute: jest.fn().mockImplementation(() => Promise.reject(new Error('relation "agent_queue" does not exist'))),
      update: jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }) }),
      delete: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(undefined) }),
      insert: jest.fn().mockReturnValue({ values: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([{ id: 'audit-1' }]) }) }),
      transaction: jest.fn(async (cb: any) => cb(mockDb)),
    };
    mockDb.transaction = jest.fn(async (cb: any) => cb(mockDb));
    (getLGPDContributions as jest.Mock).mockReturnValue([]);
    (getDb as jest.Mock).mockReturnValue(mockDb);

    // Should not throw when table does not exist — safe omission
    await expect(anonymizePatient(clinicId, patientId, 'user-1')).resolves.toEqual(expect.objectContaining({ anonymized: true }));
  });
});
