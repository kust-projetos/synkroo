import { resolveInterlocutor, resolveFuncionario } from '../interlocutor';
import type { InterlocutorDeps } from '../types';

const deps = (over: Partial<InterlocutorDeps> = {}): InterlocutorDeps => ({
  findPatientByPhone: async () => null,
  findLeadByPhone: async () => null,
  ...over,
});

describe('resolveInterlocutor (whatsapp)', () => {
  it('patient → persona paciente + name in context', async () => {
    const r = await resolveInterlocutor(deps({ findPatientByPhone: async () => ({ id: 'p1', name: 'João' }) }), 'c1', '5511999');
    expect(r.personaType).toBe('paciente');
    expect(r.patientId).toBe('p1');
    expect(r.context).toContain('João');
  });

  it('lead (not patient) → persona vendas', async () => {
    const r = await resolveInterlocutor(deps({ findLeadByPhone: async () => ({ id: 'l1', name: 'Maria' }) }), 'c1', '5511999');
    expect(r.personaType).toBe('vendas');
    expect(r.leadId).toBe('l1');
  });

  it('unknown → persona recepcao, no sensitive context', async () => {
    const r = await resolveInterlocutor(deps(), 'c1', '5511999');
    expect(r.personaType).toBe('recepcao');
    expect(r.context).toBe('');
  });
});

describe('resolveFuncionario (chat)', () => {
  it('logged-in user → persona funcionario', () => {
    const r = resolveFuncionario('user-1', 'Dra. Ana');
    expect(r.personaType).toBe('funcionario');
    expect(r.peerId).toBe('user-1');
  });
});
