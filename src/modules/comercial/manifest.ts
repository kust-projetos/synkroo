/**
 * Comercial — module manifest.
 */
export const comercialManifest = {
  id: 'comercial' as const,
  name: 'Comercial',
  alwaysOn: false,
  menu: [
    {
      moduleId: 'comercial',
      permission: 'comercial:view',
      label: 'Leads',
      path: '/dashboard/leads',
      icon: 'UserGroupIcon',
    },
    {
      moduleId: 'comercial',
      permission: 'comercial:view',
      label: 'Pipeline',
      path: '/dashboard/crm/pipeline',
      icon: 'QueueListIcon',
    },
  ],
  jobs: [
    {
      moduleId: 'comercial',
      jobType: 'comercial.hot-leads',
      cron: '*/5 * * * *',
      description: 'Process hot lead notifications',
    },
  ],
};
