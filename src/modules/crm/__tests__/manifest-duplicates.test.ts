import {
  crmAccessPermissions,
  crmActions,
  crmManifest,
  crmPermissions,
} from '@/modules/crm';

const EXISTING_PERMISSIONS = [
  'crm:view',
  'crm:manage_notes',
  'crm:manage_tags',
] as const;
const DUPLICATE_PERMISSIONS = [
  'crm:review_duplicates',
  'crm:merge_patients',
  'crm:merge_leads',
] as const;

describe('CRM duplicate review permissions', () => {
  it('preserves existing CRM permissions', () => {
    expect(crmPermissions.slice(0, EXISTING_PERMISSIONS.length)).toEqual(
      EXISTING_PERMISSIONS,
    );
  });

  it('adds duplicate review and owner-specific merge permissions', () => {
    expect(crmPermissions).toEqual(
      expect.arrayContaining(DUPLICATE_PERMISSIONS),
    );
  });

  it('publishes every permission through the RBAC catalog shape', () => {
    expect(
      crmAccessPermissions.map(({ key, module }) => ({ key, module })),
    ).toEqual(
      crmPermissions.map((key) => ({ key, module: 'crm' })),
    );
  });

  it('keeps the existing contacts menu contract', () => {
    expect(crmManifest).toMatchObject({
      id: 'crm',
      name: 'CRM',
      menu: [
        {
          moduleId: 'crm',
          permission: 'crm:view',
          label: 'Contatos',
          path: '/dashboard/contatos',
        },
      ],
    });
  });

  it('does not expose owner merge actions in crmActions (15 human actions)', () => {
    const names = crmActions.map((a) => a.name);
    // 15 human actions — no owner/system-only
    expect(names.sort()).toEqual([
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
    // Owner merges (operacional.mesclarPacientes, comercial.mesclarLeads) are NOT here
    expect(names).not.toContain('crm.mesclarLeads');
    expect(names).not.toContain('crm.mesclarPacientes');
    // System-only
    expect(names).not.toContain('crm.reprocessarSugestoesDuplicidade');
  });
});
