/**
 * Agente IA — module manifest.
 */
export const iaManifest = {
  id: 'ia' as const,
  name: 'Agente IA',
  alwaysOn: false,
  menu: [
    {
      moduleId: 'ia',
      permission: 'ia:chat',
      label: 'Assistente IA',
      path: '/dashboard/ia',
      icon: 'SparklesIcon',
    },
  ],
  jobs: [] as string[],
};
