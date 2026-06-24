/**
 * IA — module manifest.
 */
export const iaManifest = {
  id: 'ia' as const,
  name: 'IA',
  alwaysOn: false,
  menu: [
    {
      moduleId: 'ia',
      permission: 'ia:chat',
      label: 'Chat IA',
      path: '/dashboard/ia/chat',
      icon: 'SparklesIcon',
    },
  ],
  jobs: [],
};
