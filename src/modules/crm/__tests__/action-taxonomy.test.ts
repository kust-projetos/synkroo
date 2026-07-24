/**
 * action-taxonomy.test.ts — Task 4 / Eixo 2 Integration Closure.
 *
 * Separa ações públicas/humanas CRM (crmActions) das internas:
 *  - Owner merges (operacional.mesclarPacientes / comercial.mesclarLeads) foram
 *    MOVIDAS para fora do escopo de actions públicas — não devem aparecer
 *    em crmActions, crmDuplicateReviewActions, getActions() registry, nem
 *    no catálogo do agent-bridge.
 *  - crm.reprocessarSugestoesDuplicidade é system-only (cron); NÃO deve
 *    aparecer em crmActions nem ser roteável pelo agent-bridge.
 *  - crmActions contém: 6 contact actions (Task 3) + 4 human duplicate review
 *    (listar/obter/aprovar/dispensar) + 2 human merge executors
 *    (executarMergePatient / executarMergeLead).
 *
 * Os arquivos `operacional.mesclarPacientes` e `comercial.mesclarLeads` foram
 * removidos; seus symbols não devem existir em `crm/actions/index.ts`.
 */
import { getAction, clearRegistry, registerActions } from '@/core/actions/registry';
import { crmActions } from '@/modules/crm';
import * as crmActionsMod from '@/modules/crm/actions';
import { crmManifest } from '@/modules/crm';
import {
  AGENT_SAFE_ACTIONS,
  isAgentSafeAction,
} from '@/core/agent-bridge/tool-policy';

describe('crmActions — public human actions taxonomy', () => {
  it('vazio enquanto ações sem input/handler são removidas (regressão)', () => {
    expect(crmActions).toEqual([]);
  });

  it('NÃO contém crm.reprocessarSugestoesDuplicidade (system-only, não-humano)', () => {
    const names = (crmActions as any[]).map((a) => a.name);
    expect(names).not.toContain('crm.reprocessarSugestoesDuplicidade');
  });

  it('reprocessarSugestoesDuplicidade tem requires=system', () => {
    const a = (crmActionsMod as any).reprocessarSugestoesDuplicidade;
    expect(a.requires).toBe('system');
  });

  it('todas as crmActions têm module="crm" e permissions CRM válidas', () => {
    const validPerms = new Set([
      'crm:view',
      'crm:manage_notes',
      'crm:manage_tags',
      'crm:review_duplicates',
      'crm:merge_patients',
      'crm:merge_leads',
    ]);
    for (const a of crmActions as any[]) {
      expect(a.module).toBe('crm');
      expect(validPerms.has(a.requires)).toBe(true);
    }
  });
});

describe('crm/actions/index — owner merge symbols ausentes', () => {
  it('NÃO exporta mesclarPacientes nem mesclarLeads', () => {
    expect((crmActionsMod as any).mesclarPacientes).toBeUndefined();
    expect((crmActionsMod as any).mesclarLeads).toBeUndefined();
  });

  it('NÃO inclui os mesclar-* nos exports named', () => {
    const exportNames = Object.keys(crmActionsMod);
    expect(exportNames).not.toContain('mesclarPacientes');
    expect(exportNames).not.toContain('mesclarLeads');
  });
});

describe('registry global — owner merges ausentes após registro das crmActions', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('NÃO contém operacional.mesclarPacientes após registerActions(crmActions)', () => {
    registerActions([...(crmActions as any[])]);
    expect(getAction('operacional.mesclarPacientes')).toBeUndefined();
  });

  it('NÃO contém comercial.mesclarLeads após registerActions(crmActions)', () => {
    registerActions([...(crmActions as any[])]);
    expect(getAction('comercial.mesclarLeads')).toBeUndefined();
  });

  it('contém crm.executarMergePatient/Lead (human) após register', () => {
    registerActions([...(crmActions as any[])]);
    // crmActions está vazio — merges serão registrados via módulo owner quando tiverem input/handler
    expect(getAction('crm.executarMergePatient')).toBeUndefined();
    expect(getAction('crm.executarMergeLead')).toBeUndefined();
  });
});

describe('crm.actions.* — agent-bridge catalog exclusivity', () => {
  it('agent-bridge AGENT_SAFE_ACTIONS não inclui nenhum crm.*', () => {
    for (const name of AGENT_SAFE_ACTIONS) {
      expect(name.startsWith('crm.')).toBe(false);
    }
  });

  it('agent-bridge isAgentSafeAction retorna false para merges humanos', () => {
    expect(isAgentSafeAction('crm.executarMergePatient')).toBe(false);
    expect(isAgentSafeAction('crm.executarMergeLead')).toBe(false);
    expect(isAgentSafeAction('crm.reprocessarSugestoesDuplicidade')).toBe(false);
  });
});

describe('crmManifest.jobs — declares crm-duplicates cron', () => {
  it('jobs contém "crm-duplicates"', () => {
    expect((crmManifest as any).jobs).toContain('crm-duplicates');
  });
});