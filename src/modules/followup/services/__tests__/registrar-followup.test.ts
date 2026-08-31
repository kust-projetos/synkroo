/**
 * Unit tests for registrarFeedback — feedback ownership validation.
 *
 * Verifies the service rejects feedback for foreign patients/appointments
 * before attempting insertion.
 */

import { registrarFeedback } from '../followup-service';

const mockFindPatient = jest.fn();
const mockFindAppointment = jest.fn();
const mockCreateFeedback = jest.fn();

jest.mock('@/modules/followup/repositories/followup-repository', () => ({
  findPatientForClinic: (...a: unknown[]) => mockFindPatient(...a),
  findAppointmentForClinicPatient: (...a: unknown[]) => mockFindAppointment(...a),
  createFeedback: (...a: unknown[]) => mockCreateFeedback(...a),
}));

describe('registrarFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates feedback when patient belongs to clinic (no appointment)', async () => {
    mockFindPatient.mockResolvedValueOnce({ id: 'patient-a', name: 'A' });
    mockCreateFeedback.mockResolvedValueOnce(undefined);

    const result = await registrarFeedback({
      clinicId: 'clinic-a',
      patientId: 'patient-a',
      feedbackType: 'post_consultation',
    });

    expect(result.success).toBe(true);
    expect(mockCreateFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: 'clinic-a', patientId: 'patient-a' }),
    );
  });

  it('creates feedback when patient AND appointment belong to clinic', async () => {
    mockFindPatient.mockResolvedValueOnce({ id: 'patient-a', name: 'A' });
    mockFindAppointment.mockResolvedValueOnce({ id: 'appointment-a' });
    mockCreateFeedback.mockResolvedValueOnce(undefined);

    const result = await registrarFeedback({
      clinicId: 'clinic-a',
      patientId: 'patient-a',
      appointmentId: 'appointment-a',
      feedbackType: 'post_consultation',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a foreign patient before insert', async () => {
    mockFindPatient.mockResolvedValueOnce(null);

    await expect(
      registrarFeedback({
        clinicId: 'clinic-a',
        patientId: 'patient-b',
        feedbackType: 'post_consultation',
      }),
    ).rejects.toMatchObject({ code: 'not_found' });

    expect(mockCreateFeedback).not.toHaveBeenCalled();
  });

  it('rejects a mismatched appointment before insert', async () => {
    mockFindPatient.mockResolvedValueOnce({ id: 'patient-a', name: 'A' });
    mockFindAppointment.mockResolvedValueOnce(null);

    await expect(
      registrarFeedback({
        clinicId: 'clinic-a',
        patientId: 'patient-a',
        appointmentId: 'appointment-b',
        feedbackType: 'post_consultation',
      }),
    ).rejects.toMatchObject({ code: 'not_found' });

    expect(mockCreateFeedback).not.toHaveBeenCalled();
  });
});
