/**
 * Etapa 5.3 + SYN-API-002 — audit trail (ADR-BASE-12): writeActionLog receives
 * exactly the allowlisted schedule fields for appointment mutations.
 * The patientId allowlist on atualizar-consulta IS the reassignment telemetry.
 */

import { randomUUID } from 'node:crypto';

const mockFindByIdWithJoins = jest.fn();
const mockUpdateAppointmentAndTouchVisit = jest.fn();
const mockFindPatientById = jest.fn();
const mockFindDentistById = jest.fn();
const mockRemarcar = jest.fn();

jest.mock('../../repositories/appointments-repository', () => ({
  findByIdWithJoins: (...args: unknown[]) => mockFindByIdWithJoins(...args),
  updateAppointmentAndTouchVisit: (...args: unknown[]) => mockUpdateAppointmentAndTouchVisit(...args),
}));

jest.mock('../../repositories/patients-repository', () => ({
  findById: (...args: unknown[]) => mockFindPatientById(...args),
}));

jest.mock('../../repositories/catalog-repository', () => ({
  findDentistById: (...args: unknown[]) => mockFindDentistById(...args),
  findProcedureById: jest.fn(),
}));

jest.mock('../../services/scheduling-service', () => ({
  remarcarConsulta: (...args: unknown[]) => mockRemarcar(...args),
}));

const logs: any[] = [];
jest.mock('@/core/actions/audit-writer', () => ({
  writeActionLog: (r: unknown) => { logs.push(r); },
  allowlistInput: jest.requireActual('@/core/actions/audit-writer').allowlistInput,
}));

import { runAction } from '@/core/actions/run';
import type { ActionContext } from '@/core/actions/types';
import { atualizarConsulta } from '../atualizar-consulta';
import { remarcarConsulta } from '../remarcar-consulta';

const CLINIC_ID = randomUUID();

function ctx(): ActionContext {
  return {
    source: 'user',
    clinicId: CLINIC_ID,
    user: { id: 'u1', email: 'a@b.c', name: 'A' },
    role: 'owner',
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'u1' },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  logs.length = 0;
});

describe('Etapa 5.3 — operacional auditFields (SYN-API-002)', () => {
  it('atualizarConsulta logs reassignment telemetry, never notes', async () => {
    const id = randomUUID();
    const patientId = randomUUID();
    const dentistId = randomUUID();
    mockFindByIdWithJoins
      .mockResolvedValueOnce({ id, patientId: randomUUID(), scheduledAt: new Date('2026-09-01T10:00:00Z') })
      .mockResolvedValueOnce({ id, patientId });
    mockFindPatientById.mockResolvedValue({ id: patientId });
    mockFindDentistById.mockResolvedValue({ id: dentistId });
    mockUpdateAppointmentAndTouchVisit.mockResolvedValue({ id });

    const r = await runAction(atualizarConsulta, {
      id,
      patientId,
      dentistId,
      status: 'confirmed',
      scheduledAt: '2026-09-02T10:00:00Z',
      notes: 'health-note-must-not-log',
    }, ctx());
    expect(r.ok).toBe(true);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actionName: 'operacional.atualizarConsulta', result: 'ok' });
    expect(logs[0].inputRedacted).toEqual({
      id,
      patientId,
      dentistId,
      status: 'confirmed',
      scheduledAt: '2026-09-02T10:00:00Z',
    });
  });

  it('remarcarConsulta logs id/scheduledAt/durationMinutes', async () => {
    const id = randomUUID();
    mockRemarcar.mockResolvedValue({ id });
    const r = await runAction(remarcarConsulta, {
      id,
      scheduledAt: '2026-09-03T10:00:00Z',
      durationMinutes: 45,
    }, ctx());
    expect(r.ok).toBe(true);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actionName: 'operacional.remarcarConsulta', result: 'ok' });
    expect(logs[0].inputRedacted).toEqual({
      id,
      scheduledAt: '2026-09-03T10:00:00Z',
      durationMinutes: 45,
    });
  });
});
