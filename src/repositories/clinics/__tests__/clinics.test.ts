import { findClinicById, getClinicConfig } from '../index';

const mockLimit = jest.fn();
const mockWhere = jest.fn(() => ({ limit: mockLimit }));
const mockFrom = jest.fn(() => ({ where: mockWhere }));
const mockSelect = jest.fn(() => ({ from: mockFrom }));
jest.mock('@/lib/db/client', () => ({
  getDb: () => ({ select: mockSelect }),
}));
jest.mock('@/lib/logger', () => ({ dbLogger: { info: jest.fn(), error: jest.fn() } }));

const clinicRow = {
  id: 'c1',
  name: 'Clínica Teste',
  slug: 'clinica-teste',
  phone: '11999999999',
  email: 'c@test.com',
  website: null,
  address: {},
  settings: {},
  timezone: 'America/Sao_Paulo',
  subscriptionPlan: null,
  subscriptionStatus: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('clinics repository — F3.14 clinics 45 lines', () => {
  test('findClinicById returns row when found', async () => {
    mockLimit.mockResolvedValueOnce([clinicRow]);
    const row = await findClinicById('c1');
    expect(row?.id).toBe('c1');
    expect(mockSelect).toHaveBeenCalled();
  });

  test('findClinicById returns null when not found', async () => {
    mockLimit.mockResolvedValueOnce([]);
    const row = await findClinicById('missing');
    expect(row).toBeNull();
  });

  test('getClinicConfig delegates to findClinicById', async () => {
    mockLimit.mockResolvedValueOnce([clinicRow]);
    const row = await getClinicConfig('c1');
    expect(row?.name).toBe('Clínica Teste');
  });
});
