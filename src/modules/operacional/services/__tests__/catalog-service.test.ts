/**
 * Catalog Service Tests (F5.02 Dentistas CRUD + F5.06 Procedimentos CRUD)
 */

jest.unmock('@/lib/db/client');

jest.mock('@/modules/operacional/repositories/catalog-repository', () => ({
  insertDentist: jest.fn(),
  listDentists: jest.fn(),
  findDentistById: jest.fn(),
  updateDentist: jest.fn(),
  insertProcedure: jest.fn(),
  listProcedures: jest.fn(),
  findProcedureById: jest.fn(),
  updateProcedure: jest.fn(),
}));

import * as service from '../catalog-service';
import * as repo from '@/modules/operacional/repositories/catalog-repository';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedRepo = jest.mocked(repo) as any;

describe('Catalog Service - Dentistas (F5.02)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('cria dentista com sucesso', async () => {
    mockedRepo.insertDentist.mockResolvedValue({ id: 'd1', name: 'Dr. Silva' });

    const result = await service.criarDentista({
      clinicId: 'c1',
      name: 'Dr. Silva',
      specialty: 'Ortodontia',
      cro: '12345-SP',
      phone: '11999998888',
      email: 'silva@clinica.com',
    });

    expect(result).toEqual({ id: 'd1' });
    expect(mockedRepo.insertDentist).toHaveBeenCalledWith(expect.objectContaining({
      clinicId: 'c1',
      name: 'Dr. Silva',
      specialty: 'Ortodontia',
      cro: '12345-SP',
      isActive: true,
    }));
  });

  it('lista dentistas da clinica com filtro ativo', async () => {
    mockedRepo.listDentists.mockResolvedValue([
      { id: 'd1', name: 'Dr. Silva', isActive: true },
    ]);

    const result = await service.listarDentistas('c1', { activeOnly: true });
    expect(result).toHaveLength(1);
    expect(mockedRepo.listDentists).toHaveBeenCalledWith('c1', { activeOnly: true });
  });

  it('obtem dentista por id garantindo tenant isolado', async () => {
    mockedRepo.findDentistById.mockImplementation(async (clinicId: string) =>
      clinicId === 'c1' ? { id: 'd1', clinicId: 'c1', name: 'Dr. Silva' } : null,
    );

    const result = await service.obterDentista('c1', 'd1');
    expect(result).toEqual(expect.objectContaining({ id: 'd1', name: 'Dr. Silva' }));

    // Opacidade cross-tenant: mesmo contrato 404 de recurso inexistente
    await expect(service.obterDentista('c2', 'd1')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('obter dentista inexistente → not_found (404 opaco)', async () => {
    mockedRepo.findDentistById.mockResolvedValue(null);
    await expect(service.obterDentista('c1', 'missing')).rejects.toMatchObject({
      code: 'not_found',
      message: 'Dentista não encontrado.',
    });
  });

  it('atualiza e desativa dentista (PATCH/DELETE logic)', async () => {
    mockedRepo.findDentistById.mockResolvedValue({ id: 'd1', clinicId: 'c1' });
    mockedRepo.updateDentist.mockResolvedValue({ id: 'd1', isActive: false });

    const result = await service.atualizarDentista('c1', 'd1', { isActive: false });
    expect(result).toEqual(expect.objectContaining({ id: 'd1', isActive: false }));
    expect(mockedRepo.updateDentist).toHaveBeenCalledWith('d1', { isActive: false });
  });

  it('atualizar dentista inexistente ou cross-tenant → not_found sem escrever', async () => {
    mockedRepo.findDentistById.mockResolvedValue(null);

    await expect(service.atualizarDentista('c1', 'missing', { name: 'X' })).rejects.toMatchObject({
      code: 'not_found',
      message: 'Dentista não encontrado.',
    });
    expect(mockedRepo.updateDentist).not.toHaveBeenCalled();
  });
});

describe('Catalog Service - Procedimentos (F5.06)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('cria procedimento com categoria, duracao e preco', async () => {
    mockedRepo.insertProcedure.mockResolvedValue({ id: 'proc-1', name: 'Limpeza' });

    const result = await service.criarProcedimento({
      clinicId: 'c1',
      name: 'Limpeza Dental',
      category: 'Prevencao',
      durationMinutes: 45,
      price: '250.00',
      description: 'Profilaxia completa',
    });

    expect(result).toEqual({ id: 'proc-1' });
    expect(mockedRepo.insertProcedure).toHaveBeenCalledWith(expect.objectContaining({
      clinicId: 'c1',
      name: 'Limpeza Dental',
      category: 'Prevencao',
      durationMinutes: 45,
      price: '250.00',
    }));
  });

  it('lista e atualiza procedimento', async () => {
    mockedRepo.listProcedures.mockResolvedValue([
      { id: 'proc-1', name: 'Limpeza Dental', category: 'Prevencao' },
    ]);
    mockedRepo.findProcedureById.mockResolvedValue({ id: 'proc-1', clinicId: 'c1' });
    mockedRepo.updateProcedure.mockResolvedValue({ id: 'proc-1', price: '300.00' });

    const list = await service.listarProcedimentos('c1');
    expect(list).toHaveLength(1);

    const updated = await service.atualizarProcedimento('c1', 'proc-1', { price: '300.00' });
    expect(updated).toEqual(expect.objectContaining({ id: 'proc-1', price: '300.00' }));
  });

  it('obter procedimento inexistente ou cross-tenant → not_found (404 opaco)', async () => {
    mockedRepo.findProcedureById.mockResolvedValue(null);
    await expect(service.obterProcedimento('c1', 'missing')).rejects.toMatchObject({
      code: 'not_found',
      message: 'Procedimento não encontrado.',
    });
  });

  it('atualizar procedimento inexistente ou cross-tenant → not_found sem escrever', async () => {
    mockedRepo.findProcedureById.mockResolvedValue(null);

    await expect(
      service.atualizarProcedimento('c1', 'missing', { price: '300.00' }),
    ).rejects.toMatchObject({ code: 'not_found', message: 'Procedimento não encontrado.' });
    expect(mockedRepo.updateProcedure).not.toHaveBeenCalled();
  });
});
