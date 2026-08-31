import * as fs from 'fs';
import * as path from 'path';
import { bootstrapActions, resetBootstrapForTests } from '../bootstrap';
import { getActions, clearRegistry } from '../registry';

beforeEach(() => {
  clearRegistry();
  resetBootstrapForTests();
});

it('registers all core actions deterministically and idempotently', async () => {
  await bootstrapActions();
  const names = getActions().map((a) => a.name);
  expect(names).toEqual(expect.arrayContaining([
    'core.assignUserAccess',
    'core.createRole',
    'master.setModuleContract',
    'core.listClinicUsers',
    'core.listClinicRoles',
    'core.removeUserAccess',
    'core.deactivateUser',
  ]));
  const count = getActions().length;
  await bootstrapActions();
  expect(getActions().length).toBe(count);
});

it('registers all operacional actions', async () => {
  await bootstrapActions();
  const names = getActions().map((a) => a.name);
  expect(names).toContain('operacional.agendarConsulta');
  expect(names).toContain('operacional.confirmarConsulta');
  expect(names).toContain('operacional.listarPacientes');
  expect(names).toContain('operacional.consultarDisponibilidade');
  expect(names).toContain('operacional.criarDentista');
  expect(names).toContain('operacional.listarDentistas');
  expect(names).toContain('operacional.listarWaitlist');
  expect(names).toContain('operacional.listarConfigsLembrete');
});

it('registers followup access permissions in the catalog', async () => {
  await bootstrapActions();
  const { getPermissionCatalog } = await import('@/core/rbac/catalog');
  const catalog = getPermissionCatalog();
  const keys = catalog.map((p) => p.key);
  expect(keys).toContain('followup:view');
  expect(keys).toContain('followup:manage_followups');
  expect(keys).toContain('followup:manage_campaigns');
  expect(keys).toContain('followup:manage_segments');
});

it('registers atendimento access permissions in the catalog', async () => {
  await bootstrapActions();
  const { getPermissionCatalog } = await import('@/core/rbac/catalog');
  const catalog = getPermissionCatalog();
  const keys = catalog.map((p) => p.key);
  expect(keys).toContain('atendimento:view');
  expect(keys).toContain('atendimento:manage_messages');
  expect(keys).toContain('atendimento:manage_conversations');
  expect(keys).toContain('atendimento:manage_webhooks');
  expect(keys).toContain('atendimento:manage_templates');
  expect(keys).toContain('atendimento:escalate');
});

it('registers operacional access permissions in the catalog', async () => {
  await bootstrapActions();
  const { getPermissionCatalog } = await import('@/core/rbac/catalog');
  const catalog = getPermissionCatalog();
  const keys = catalog.map((p) => p.key);
  expect(keys).toContain('operacional:view');
  expect(keys).toContain('operacional:manage_appointments');
  expect(keys).toContain('operacional:manage_patients');
  expect(keys).toContain('operacional:manage_catalog');
  expect(keys).toContain('operacional:manage_waitlist');
  expect(keys).toContain('operacional:manage_reminders');
});

// ─── IA module registry guard ─────────────────────────────────────────────────

it('registers ia access permissions in the catalog', async () => {
  await bootstrapActions();
  const { getPermissionCatalog } = await import('@/core/rbac/catalog');
  const catalog = getPermissionCatalog();
  const keys = catalog.map((p) => p.key);
  expect(keys).toContain('ia:chat');
  expect(keys).toContain('ia:manage');
});

it('is idempotent for both core and operacional', async () => {
  await bootstrapActions();
  const count1 = getActions().length;
  await bootstrapActions();
  const count2 = getActions().length;
  expect(count2).toBe(count1);
});

// ─── Atendimento module registry guard (P4) ───────────────────────────────────

it('registers all 21 atendimento actions discovered via getActions()', async () => {
  await bootstrapActions();
  const names = getActions().map((a) => a.name);

  const atendimentoActions = [
    'atendimento.iniciarConversa',
    'atendimento.listarConversas',
    'atendimento.obterConversa',
    'atendimento.arquivarConversa',
    'atendimento.escalarConversa',
    'atendimento.receberMensagem',
    'atendimento.classificarIntencao',
    'atendimento.extrairEntidades',
    'atendimento.historicoMensagens',
    'atendimento.enviarMensagem',
    'atendimento.enviarMensagemDireta',
    'atendimento.agendarMensagem',
    'atendimento.obterModeloMensagem',
    'atendimento.verificarWebhook',
    'atendimento.processarWebhookWhatsApp',
    'atendimento.statusEvolution',
    'atendimento.verificarWebhookInstagram',
    'atendimento.processarWebhookInstagram',
    'atendimento.responderInstagram',
    'atendimento.receberWidgetMensagem',
    'atendimento.obterQRCode',
  ];

  for (const name of atendimentoActions) {
    expect(names).toContain(name);
  }

  // Exact count guard — flags regressions if actions are added/removed silently
  const atendimentoCount = names.filter((n) => n.startsWith('atendimento.')).length;
  expect(atendimentoCount).toBe(21);
});

it('all atendimento actions are retrievable via getAction()', async () => {
  await bootstrapActions();
  const { getAction } = await import('../registry');

  expect(getAction('atendimento.receberMensagem')).toBeDefined();
  expect(getAction('atendimento.enviarMensagem')).toBeDefined();
  expect(getAction('atendimento.escalarConversa')).toBeDefined();
  expect(getAction('atendimento.iniciarConversa')).toBeDefined();
  expect(getAction('atendimento.statusEvolution')).toBeDefined();
  expect(getAction('atendimento.obterQRCode')).toBeDefined();
  expect(getAction('atendimento.classificarIntencao')).toBeDefined();
  expect(getAction('atendimento.extrairEntidades')).toBeDefined();
  expect(getAction('atendimento.enviarMensagemDireta')).toBeDefined();
});

// ─── CRM & Financeiro module registry guards ──────────────────────────────────

it('registers crm access permissions in the catalog', async () => {
  await bootstrapActions();
  const { getPermissionCatalog } = await import('@/core/rbac/catalog');
  const catalog = getPermissionCatalog();
  const keys = catalog.map((p) => p.key);
  expect(keys).toContain('crm:view');
  expect(keys).toContain('crm:manage_notes');
  expect(keys).toContain('crm:manage_tags');
  expect(keys).toContain('crm:review_duplicates');
  expect(keys).toContain('crm:merge_patients');
  expect(keys).toContain('crm:merge_leads');
});

it('registers financeiro access permissions in the catalog', async () => {
  await bootstrapActions();
  const { getPermissionCatalog } = await import('@/core/rbac/catalog');
  const catalog = getPermissionCatalog();
  const keys = catalog.map((p) => p.key);
  expect(keys).toContain('financeiro:view');
  expect(keys).toContain('financeiro:create_budget');
  expect(keys).toContain('financeiro:manage_budget');
  expect(keys).toContain('financeiro:record_payment');
  expect(keys).toContain('financeiro:manage_collections');
  expect(keys).toContain('financeiro:manage_gateways');
});

// ─── Guard: every src/modules/ dir must be registered in bootstrap ────────────

function getModuleDirNames(): string[] {
  const modulesDir = path.resolve(__dirname, '../../../modules');
  return fs.readdirSync(modulesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('__'))
    .map((e) => e.name);
}

function getModulesWithActionsDir(): string[] {
  const modulesDir = path.resolve(__dirname, '../../../modules');
  return fs.readdirSync(modulesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('__'))
    .filter((e) => {
      const actionsDir = path.join(modulesDir, e.name, 'actions');
      return fs.existsSync(actionsDir) && fs.statSync(actionsDir).isDirectory();
    })
    .map((e) => e.name);
}

it('every module directory is registered in the permission catalog after bootstrap', async () => {
  await bootstrapActions();
  const { getPermissionCatalog } = await import('@/core/rbac/catalog');
  const catalog = getPermissionCatalog();
  const catalogModules = new Set(catalog.map((p) => p.module));

  const dirModules = getModuleDirNames();

  const missing: string[] = [];
  for (const mod of dirModules) {
    // analytics não existe como diretório em src/modules/, mas aparece no preset-policy.json.
    // Se um dia o diretório for criado, este guard passará a exigi-lo automaticamente.
    if (!catalogModules.has(mod)) {
      missing.push(mod);
    }
  }

  if (missing.length) {
    throw new Error(
      `Modules exist in src/modules/ but are NOT registered in bootstrap:\n` +
      missing.map((m) => `  - ${m}: add dynamic import + registerActions + registerAccessPermissions to bootstrap.ts`).join('\n')
    );
  }
});

// ─── Guard: no module with actions/ dir should have zero actions registered ───

it('every module with an actions/ directory contributes at least 1 action to the registry', async () => {
  await bootstrapActions();
  const names = getActions().map((a) => a.name);

  const actionsModules = getModulesWithActionsDir();
  // ia has no actions/ directory — its actions come from a different pattern.

  const missing: string[] = [];
  for (const mod of actionsModules) {
    const hasActions = names.some((n) => n.startsWith(`${mod}.`));
    if (!hasActions) {
      missing.push(mod);
    }
  }

  if (missing.length) {
    throw new Error(
      `Modules have actions/ directories but ZERO actions registered after bootstrap:\n` +
      missing.map((m) => `  - ${m}: ensure the module exports its actions array and bootstrap registers it`).join('\n')
    );
  }
});

// ─── CRM actions composition lock ────────────────────────────────────────────

it('registers exactly 15 crm.* actions and excludes system-only reprocessarSugestoesDuplicidade', async () => {
  await bootstrapActions();
  const names = getActions().map((a) => a.name);

  const crmActionNames = names.filter((n) => n.startsWith('crm.')).sort();

  expect(crmActionNames).toHaveLength(15);
  expect(crmActionNames).toEqual([
    'crm.adicionarNotaContato',
    'crm.aprovarSugestaoDuplicidade',
    'crm.atualizarTagsContato',
    'crm.concederConsentimento',
    'crm.dispensarSugestaoDuplicidade',
    'crm.executarMergeLead',
    'crm.executarMergePatient',
    'crm.listarConsentimentos',
    'crm.listarContatos',
    'crm.listarNotasContato',
    'crm.listarSugestoesDuplicidade',
    'crm.listarTimelineContato',
    'crm.obterContato',
    'crm.obterSugestaoDuplicidade',
    'crm.revogarConsentimento',
  ]);

  // system-only: NÃO pode estar registrada como ação humana
  expect(names).not.toContain('crm.reprocessarSugestoesDuplicidade');
});

it('module action barrels are side-effect-free before explicit bootstrap', async () => {
  resetBootstrapForTests();

  await Promise.all([
    import('@/modules/core/actions'),
    import('@/modules/operacional/actions'),
    import('@/modules/atendimento/actions'),
    import('@/modules/followup/actions'),
    import('@/modules/comercial/actions'),
    import('@/modules/crm/actions'),
    import('@/modules/financeiro/actions'),
  ]);

  expect(getActions()).toEqual([]);
});

it('concurrent bootstrap calls publish the same complete action set once', async () => {
  resetBootstrapForTests();

  await Promise.all(Array.from({ length: 5 }, () => bootstrapActions()));

  const modules = await Promise.all([
    import('@/modules/core'),
    import('@/modules/operacional'),
    import('@/modules/atendimento'),
    import('@/modules/followup'),
    import('@/modules/ia'),
    import('@/modules/comercial'),
    import('@/modules/crm'),
    import('@/modules/financeiro'),
  ]);
  const expectedNames = modules.flatMap((module) => {
    const actions = Object.entries(module).find(([key]) => key.endsWith('Actions'))?.[1];
    return Array.isArray(actions) ? actions.map((action: { name: string }) => action.name) : [];
  });
  const actualNames = getActions().map((action) => action.name);

  expect(new Set(expectedNames).size).toBe(expectedNames.length);
  expect(actualNames.sort()).toEqual(expectedNames.sort());
});
