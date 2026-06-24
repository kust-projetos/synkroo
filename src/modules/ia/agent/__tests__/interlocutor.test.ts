import { createInterlocutorResolver } from '../interlocutor';
import type { InterlocutorResolver, InterlocutorResult } from '../interlocutor';

function makeResolver(deps?: {
  findByPhone?: jest.Mock;
  findLeadByPhone?: jest.Mock;
}): InterlocutorResolver {
  return createInterlocutorResolver({
    findByPhone: deps?.findByPhone ?? jest.fn().mockResolvedValue(null),
    findLeadByPhone: deps?.findLeadByPhone ?? jest.fn().mockResolvedValue(null),
  });
}

describe('InterlocutorResolver', () => {
  describe('resolve()', () => {
    it('resolves userId to funcionario/gestao', async () => {
      const resolver = makeResolver();
      const result = await resolver.resolve({
        userId: 'user-123',
        clinicId: 'clinic-1',
      });

      expect(result.kind).toBe('funcionario');
      expect(result.personaType).toBe('gestao');
      expect(result.context.userId).toBe('user-123');
      expect(result.context.patientId).toBeUndefined();
      expect(result.context.leadId).toBeUndefined();
    });

    it('resolves phone matching patient to paciente/relacionamento', async () => {
      const findByPhone = jest.fn().mockResolvedValue({ id: 'patient-456' });
      const resolver = makeResolver({ findByPhone });

      const result = await resolver.resolve({
        phone: '+5511999998888',
        clinicId: 'clinic-1',
      });

      expect(result.kind).toBe('paciente');
      expect(result.personaType).toBe('relacionamento');
      expect(result.context.patientId).toBe('patient-456');
      expect(result.context.phone).toBe('+5511999998888');
      expect(findByPhone).toHaveBeenCalledWith('clinic-1', '+5511999998888');
    });

    it('resolves phone matching lead to lead/vendas', async () => {
      const findByPhone = jest.fn().mockResolvedValue(null);
      const findLeadByPhone = jest.fn().mockResolvedValue({ id: 'lead-789' });
      const resolver = makeResolver({ findByPhone, findLeadByPhone });

      const result = await resolver.resolve({
        phone: '+5511988887777',
        clinicId: 'clinic-1',
      });

      expect(result.kind).toBe('lead');
      expect(result.personaType).toBe('vendas');
      expect(result.context.leadId).toBe('lead-789');
      expect(result.context.phone).toBe('+5511988887777');
      expect(findByPhone).toHaveBeenCalledWith('clinic-1', '+5511988887777');
      expect(findLeadByPhone).toHaveBeenCalledWith('clinic-1', '+5511988887777');
    });

    it('resolves phone with no match to desconhecido/recepcao', async () => {
      const findByPhone = jest.fn().mockResolvedValue(null);
      const findLeadByPhone = jest.fn().mockResolvedValue(null);
      const resolver = makeResolver({ findByPhone, findLeadByPhone });

      const result = await resolver.resolve({
        phone: '+5511977776666',
        clinicId: 'clinic-1',
      });

      expect(result.kind).toBe('desconhecido');
      expect(result.personaType).toBe('recepcao');
      expect(result.context.phone).toBe('+5511977776666');
      expect(result.context.patientId).toBeUndefined();
      expect(result.context.leadId).toBeUndefined();
    });

    it('resolves neither phone nor userId to desconhecido/recepcao', async () => {
      const resolver = makeResolver();
      const result = await resolver.resolve({
        clinicId: 'clinic-1',
      });

      expect(result.kind).toBe('desconhecido');
      expect(result.personaType).toBe('recepcao');
      expect(result.context.phone).toBeUndefined();
      expect(result.context.userId).toBeUndefined();
    });

    it('userId takes priority over phone', async () => {
      const findByPhone = jest.fn().mockResolvedValue({ id: 'patient-456' });
      const resolver = makeResolver({ findByPhone });

      const result = await resolver.resolve({
        userId: 'user-123',
        phone: '+5511999998888',
        clinicId: 'clinic-1',
      });

      expect(result.kind).toBe('funcionario');
      expect(result.personaType).toBe('gestao');
      expect(findByPhone).not.toHaveBeenCalled();
    });

    it('does not check lead when patient is found', async () => {
      const findByPhone = jest.fn().mockResolvedValue({ id: 'patient-456' });
      const findLeadByPhone = jest.fn();
      const resolver = makeResolver({ findByPhone, findLeadByPhone });

      await resolver.resolve({
        phone: '+5511999998888',
        clinicId: 'clinic-1',
      });

      expect(findByPhone).toHaveBeenCalled();
      expect(findLeadByPhone).not.toHaveBeenCalled();
    });
  });
});
