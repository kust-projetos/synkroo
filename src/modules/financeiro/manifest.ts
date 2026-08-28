/**
 * Financeiro — module manifest.
 */
export const financeiroManifest = {
  id: 'financeiro' as const,
  name: 'Financeiro',
  dependsOn: ['operacional', 'comercial'] as const,
  alwaysOn: false,
  menu: [
    {
      moduleId: 'financeiro',
      permission: 'financeiro:view',
      label: 'Financeiro',
      path: '/dashboard/financeiro',
      icon: 'CurrencyDollarIcon',
    },
  ],
  jobs: ['financeiro-collections'],
};
