/** CRM — module manifest. */
export const crmManifest = {
  id: 'crm' as const,
  name: 'CRM',
  alwaysOn: false,
  menu: [
    {
      moduleId: 'crm',
      permission: 'crm:view',
      label: 'Contatos',
      path: '/dashboard/contatos',
      icon: 'UsersIcon',
    },
  ],
  jobs: [] as string[],
};
