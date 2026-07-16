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

  it('does not expose owner merge actions from the CRM registry', () => {
    // Task 4: crmActions agora contém 12 ações públicas humanas
    // (ver action-taxonomy.test.ts para o contrato completo). O invariante
    // "owner merges não aparecem em crmActions" continua valendo.
    const names = (crmActions as Array<{ name: string }>).map((a) => a.name);
    expect(names).not.toContain('operacional.mesclarPacientes');
    expect(names).not.toContain('comercial.mesclarLeads');
    expect(names).not.toContain('crm.reprocessarSugestoesDuplicidade');
  });
});
