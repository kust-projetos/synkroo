/**
 * Follow-up e Retenção — module manifest.
 */
export const followupManifest = {
  id: 'followup' as const,
  name: 'Follow-up',
  alwaysOn: false,
  menu: [
    {
      moduleId: 'followup',
      permission: 'followup:view',
      label: 'Follow-up',
      path: '/dashboard/followup',
      icon: 'BellAlertIcon',
    },
    {
      moduleId: 'followup',
      permission: 'followup:manage_followups',
      label: 'Follow-up',
      path: '/dashboard/followup',
      icon: 'BellAlertIcon',
    },
  ],
  jobs: ['followup.processar'],
};
