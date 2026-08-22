import { assertClinicScope } from '../tenant-scope';
import { ActionError } from '../types';

describe('assertClinicScope utility', () => {
  it('allows matching input clinicId and context clinicId', () => {
    expect(() => {
      assertClinicScope('clinic-123', { clinicId: 'clinic-123' });
    }).not.toThrow();
  });

  it('throws ActionError with code forbidden when clinicId differs', () => {
    expect(() => {
      assertClinicScope('clinic-attacker', { clinicId: 'clinic-victim' });
    }).toThrow(ActionError);

    try {
      assertClinicScope('clinic-attacker', { clinicId: 'clinic-victim' });
    } catch (err) {
      expect(err).toBeInstanceOf(ActionError);
      expect((err as ActionError).code).toBe('forbidden');
      expect((err as ActionError).message).toBe('A clínica informada não corresponde ao contexto ativo.');
    }
  });

  it('throws forbidden when input clinicId is empty', () => {
    expect(() => {
      assertClinicScope('', { clinicId: 'clinic-123' });
    }).toThrow(ActionError);
  });

  it('throws forbidden when context clinicId is empty', () => {
    expect(() => {
      assertClinicScope('clinic-123', { clinicId: '' });
    }).toThrow(ActionError);
  });
});
