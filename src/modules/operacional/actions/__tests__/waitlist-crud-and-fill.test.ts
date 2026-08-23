/**
 * Unit tests for Waitlist CRUD and Idempotent Slot Fill Actions
 */

import { ActionError } from '@/core/actions/types';

const mockRepo = {
  findWaitlistById: jest.fn(),
  listWaitlist: jest.fn(),
  insertWaitlist: jest.fn(),
  updateWaitlist: jest.fn(),
  cancelWaitlistEntry: jest.fn(),
  preencherVagaWaitlist: jest.fn(),
};

jest.mock('@/modules/operacional/repositories/waitlist-repository', () => mockRepo);

import { entrarWaitlist } from '../entrar-waitlist';
import { listarWaitlist } from '../listar-waitlist';
import { obterWaitlist } from '../obter-waitlist';
import { atualizarWaitlist } from '../atualizar-waitlist';
import { cancelarWaitlist } from '../cancelar-waitlist';
import { preencherWaitlist } from '../preencher-waitlist';

describe('Waitlist Actions (CRUD & Idempotent Fill)', () => {
  const clinicId = '00000000-0000-0000-0000-00000000000f';
  const ctx = {
    userId: '00000000-0000-0000-0000-000000000001',
    clinicId,
    role: 'admin',
    permissions: ['operacional:manage_waitlist', 'operacional:view'],
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('entrarWaitlist', () => {
    it('creates waitlist entry successfully for future date', async () => {
      mockRepo.insertWaitlist.mockResolvedValueOnce({ id: 'w1' });
      const res = await entrarWaitlist.handler(
        {
          patientId: '00000000-0000-0000-0000-000000000010',
          preferredDate: '2026-12-01',
          preferredTimeStart: '09:00',
          preferredTimeEnd: '11:00',
          priority: 3,
        },
        ctx,
      );
      expect(res).toEqual({ id: 'w1' });
      expect(mockRepo.insertWaitlist).toHaveBeenCalledWith(
        expect.objectContaining({
          clinicId,
          patientId: '00000000-0000-0000-0000-000000000010',
          preferredDate: '2026-12-01',
        }),
      );
    });

    it('rejects past dates', async () => {
      await expect(
        entrarWaitlist.handler(
          {
            patientId: '00000000-0000-0000-0000-000000000010',
            preferredDate: '2020-01-01',
            preferredTimeStart: '09:00',
          },
          ctx,
        ),
      ).rejects.toThrow('preferredDate must be today or in the future');
    });
  });

  describe('obterWaitlist', () => {
    it('returns entry when found in clinic', async () => {
      mockRepo.findWaitlistById.mockResolvedValueOnce({
        id: 'w1',
        clinicId,
        patientId: 'p1',
        status: 'waiting',
      });
      const res = await obterWaitlist.handler({ id: '00000000-0000-0000-0000-000000000011' }, ctx);
      expect(res).toEqual(
        expect.objectContaining({
          id: 'w1',
          status: 'waiting',
        }),
      );
    });

    it('throws not_found when entry does not exist or belongs to another clinic', async () => {
      mockRepo.findWaitlistById.mockResolvedValueOnce(null);
      await expect(
        obterWaitlist.handler({ id: '00000000-0000-0000-0000-000000000011' }, ctx),
      ).rejects.toThrow('Entrada da waitlist não encontrada');
    });
  });

  describe('atualizarWaitlist', () => {
    it('updates entry successfully', async () => {
      mockRepo.findWaitlistById.mockResolvedValueOnce({
        id: 'w1',
        clinicId,
        patientId: 'p1',
        status: 'waiting',
      });
      mockRepo.updateWaitlist.mockResolvedValueOnce({
        id: 'w1',
        priority: 10,
        notes: 'Urgente',
      });

      const res = await atualizarWaitlist.handler(
        {
          id: '00000000-0000-0000-0000-000000000011',
          priority: 10,
          notes: 'Urgente',
        },
        ctx,
      );

      expect(res).toEqual({ id: 'w1' });
      expect(mockRepo.updateWaitlist).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000011',
        expect.objectContaining({ priority: 10, notes: 'Urgente' }),
      );
    });

    it('rejects update if already scheduled', async () => {
      mockRepo.findWaitlistById.mockResolvedValueOnce({
        id: 'w1',
        clinicId,
        patientId: 'p1',
        status: 'scheduled',
        scheduledAppointmentId: 'appt-1',
      });

      await expect(
        atualizarWaitlist.handler(
          {
            id: '00000000-0000-0000-0000-000000000011',
            priority: 10,
          },
          ctx,
        ),
      ).rejects.toThrow('Não é possível alterar uma entrada já agendada');
    });
  });

  describe('cancelarWaitlist', () => {
    it('cancels entry', async () => {
      mockRepo.findWaitlistById.mockResolvedValueOnce({
        id: 'w1',
        clinicId,
        patientId: 'p1',
        status: 'waiting',
      });
      mockRepo.cancelWaitlistEntry.mockResolvedValueOnce({ id: 'w1', status: 'cancelled' });

      const res = await cancelarWaitlist.handler(
        {
          id: '00000000-0000-0000-0000-000000000011',
          reason: 'Paciente desistiu',
        },
        ctx,
      );

      expect(res).toEqual({ id: '00000000-0000-0000-0000-000000000011' });
      expect(mockRepo.cancelWaitlistEntry).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000011',
        'Paciente desistiu',
      );
    });
  });

  describe('preencherWaitlist (Idempotent Slot Fill)', () => {
    it('fills waitlist slot and creates appointment (first call)', async () => {
      mockRepo.preencherVagaWaitlist.mockResolvedValueOnce({
        id: 'appt-new',
        waitlistId: 'w1',
        alreadyScheduled: false,
      });

      const res = await preencherWaitlist.handler(
        {
          waitlistId: '00000000-0000-0000-0000-000000000011',
          scheduledAt: new Date('2026-12-01T10:00:00Z'),
          durationMinutes: 45,
          dentistId: '00000000-0000-0000-0000-000000000020',
        },
        ctx,
      );

      expect(res).toEqual({
        id: 'appt-new',
        waitlistId: 'w1',
        alreadyScheduled: false,
      });
      expect(mockRepo.preencherVagaWaitlist).toHaveBeenCalledWith(
        clinicId,
        expect.objectContaining({
          waitlistId: '00000000-0000-0000-0000-000000000011',
          durationMinutes: 45,
        }),
      );
    });

    it('returns existing appointment idempotently if already filled (second call)', async () => {
      mockRepo.preencherVagaWaitlist.mockResolvedValueOnce({
        id: 'appt-existing',
        waitlistId: 'w1',
        alreadyScheduled: true,
      });

      const res = await preencherWaitlist.handler(
        {
          waitlistId: '00000000-0000-0000-0000-000000000011',
          scheduledAt: new Date('2026-12-01T10:00:00Z'),
          durationMinutes: 30,
        },
        ctx,
      );

      expect(res).toEqual({
        id: 'appt-existing',
        waitlistId: 'w1',
        alreadyScheduled: true,
      });
    });

    it('translates 23P01 conflict into conflict ActionError', async () => {
      const err: any = new Error('exclusion constraint');
      err.cause = { code: '23P01' };
      mockRepo.preencherVagaWaitlist.mockRejectedValueOnce(err);

      await expect(
        preencherWaitlist.handler(
          {
            waitlistId: '00000000-0000-0000-0000-000000000011',
            scheduledAt: new Date('2026-12-01T10:00:00Z'),
            durationMinutes: 30,
          },
          ctx,
        ),
      ).rejects.toThrow('Horário indisponível para este dentista');
    });
  });
});
