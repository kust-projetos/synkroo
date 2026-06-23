/**
 * Unit tests: patients service dedup logic.
 *
 * Run: npm test -- src/modules/operacional/services/__tests__/patients-service.test.ts
 */

jest.unmock('@/lib/db/client');

jest.mock('@/modules/operacional/repositories/patients-repository', () => {
  return {
    normalizePhone: (v: string) => v.replace(/\D/g, ''),
    normalizeCpf: (v: string) => v.replace(/\D/g, ''),
    findByPhone: jest.fn(),
    findByCpf: jest.fn(),
    insertPatient: jest.fn(),
    updatePatient: jest.fn(),
    listPatients: jest.fn(),
    findById: jest.fn(),
  };
});

import { ActionError } from '@/core/actions/types';
import { criarPaciente } from '../patients-service';
import * as repo from '@/modules/operacional/repositories/patients-repository';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mocked = jest.mocked(repo) as any;

beforeEach(() => {
  jest.resetAllMocks();
});

describe('criarPaciente — dedup', () => {
  it('creates patient when phone and CPF are new; inserts normalized', async () => {
    mocked.findByPhone.mockResolvedValue(null);
    mocked.findByCpf.mockResolvedValue(null);
    mocked.insertPatient.mockResolvedValue({ id: 'p1' });

    await expect(
      criarPaciente({
        clinicId: 'c1',
        name: 'Alice',
        phone: '+55 (11) 99999-0000',
        cpf: '123.456.789-00',
      }),
    ).resolves.toEqual({ id: 'p1' });

    // normalizePhone strips all non-digits: '+55 (11) 99999-0000' → '5511999990000'
    expect(mocked.insertPatient).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '5511999990000', cpf: '12345678900' }),
    );
  });

  it('rejects duplicate by phone → conflict', async () => {
    mocked.findByPhone.mockResolvedValue({ id: 'existing' });
    mocked.findByCpf.mockResolvedValue(null);

    await expect(
      criarPaciente({ clinicId: 'c1', name: 'Bob', phone: '+5511999' }),
    ).rejects.toBeInstanceOf(ActionError);

    await expect(
      criarPaciente({ clinicId: 'c1', name: 'Bob', phone: '+5511999' }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('rejects duplicate by CPF → conflict', async () => {
    mocked.findByPhone.mockResolvedValue(null);
    mocked.findByCpf.mockResolvedValue({ id: 'existing' });

    await expect(
      criarPaciente({
        clinicId: 'c1',
        name: 'Carol',
        phone: '+5511888',
        cpf: '987.654.321-00',
      }),
    ).rejects.toBeInstanceOf(ActionError);

    await expect(
      criarPaciente({
        clinicId: 'c1',
        name: 'Carol',
        phone: '+5511888',
        cpf: '987.654.321-00',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('normalizes phone to digits-only', async () => {
    mocked.findByPhone.mockResolvedValue(null);
    mocked.findByCpf.mockResolvedValue(null);
    mocked.insertPatient.mockResolvedValue({ id: 'p2' });

    await criarPaciente({ clinicId: 'c1', name: 'Dave', phone: '(11) 91234-5678' });

    // normalizePhone strips all non-digits: '(11) 91234-5678' → '11912345678'
    expect(mocked.findByPhone).toHaveBeenCalledWith('c1', '11912345678');
    expect(mocked.insertPatient).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '11912345678' }),
    );
  });

  it('normalizes CPF to digits-only', async () => {
    mocked.findByPhone.mockResolvedValue(null);
    mocked.findByCpf.mockResolvedValue(null);
    mocked.insertPatient.mockResolvedValue({ id: 'p3' });

    await criarPaciente({ clinicId: 'c1', name: 'Eve', phone: '+5511000', cpf: '000.111.222-33' });

    expect(mocked.findByCpf).toHaveBeenCalledWith('c1', '00011122233');
    expect(mocked.insertPatient).toHaveBeenCalledWith(
      expect.objectContaining({ cpf: '00011122233' }),
    );
  });

  it('skips CPF dedup check when CPF is not provided', async () => {
    mocked.findByPhone.mockResolvedValue(null);
    mocked.findByCpf.mockResolvedValue(null); // should not be called
    mocked.insertPatient.mockResolvedValue({ id: 'p4' });

    await criarPaciente({ clinicId: 'c1', name: 'Frank', phone: '+5511777' });

    expect(mocked.findByCpf).not.toHaveBeenCalled();
    expect(mocked.insertPatient).toHaveBeenCalledWith(
      expect.objectContaining({ cpf: null }),
    );
  });
});
