/**
 * Unit tests: Comercial action registry (Task 3).
 *
 * Tests that bootstrapActions() registers comercial actions
 * and that they appear in the action registry.
 */

import { getAction, clearRegistry } from '@/core/actions/registry';
import { bootstrapActions, resetBootstrapForTests } from '@/core/actions/bootstrap';

const COMMERCIAL_ACTION_NAMES = [
  'comercial.capturarLead',
  'comercial.qualificarLead',
  'comercial.listarLeads',
  'comercial.obterLead',
  'comercial.atualizarLead',
  'comercial.moverLeadEtapa',
  'comercial.converterLead',
  'comercial.agendarAvaliacao',
  'comercial.listarPipeline',
  'comercial.criarEtapaPipeline',
  'comercial.atualizarEtapaPipeline',
  'comercial.removerEtapaPipeline',
  'comercial.reordenarEtapasPipeline',
  'comercial.criarTaskComercial',
  'comercial.listarTasksComerciais',
  'comercial.atualizarTaskComercial',
  'comercial.fecharTaskComercial',
  'comercial.processarNotificacoesLeadsQuentes',
];

describe('comercial action registry', () => {
  beforeEach(() => {
    clearRegistry();
    resetBootstrapForTests();
  });

  it('registers all comercial actions via bootstrap', async () => {
    await bootstrapActions();

    for (const name of COMMERCIAL_ACTION_NAMES) {
      expect(getAction(name)).toBeDefined();
    }
  });

  it('comercial.capturarLead has correct shape', async () => {
    await bootstrapActions();
    const action = getAction('comercial.capturarLead');
    expect(action).toBeDefined();
    expect(action!.module).toBe('comercial');
    expect(action!.requires).toBe('comercial:capture_leads');
    expect(action!.input).toBeDefined();
    expect(typeof action!.handler).toBe('function');
  });

  it('comercial.listarPipeline has correct shape', async () => {
    await bootstrapActions();
    const action = getAction('comercial.listarPipeline');
    expect(action).toBeDefined();
    expect(action!.module).toBe('comercial');
    expect(action!.requires).toBe('comercial:view');
  });
});
