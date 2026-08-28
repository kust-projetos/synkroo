/**
 * Atendimento Multicanal — module manifest.
 */
export const atendimentoManifest = {
  id: 'atendimento' as const,
  name: 'Atendimento',
  dependsOn: ['operacional', 'comercial'] as const,
  alwaysOn: false,
  menu: [
    {
      moduleId: 'atendimento',
      permission: 'atendimento:view',
      label: 'Conversas',
      path: '/dashboard/conversas',
      icon: 'ChatBubbleLeftRightIcon',
    },
    {
      moduleId: 'atendimento',
      permission: 'atendimento:manage_messages',
      label: 'Conversas',
      path: '/dashboard/conversas',
      icon: 'ChatBubbleLeftRightIcon',
    },
  ],
  jobs: [],
};
