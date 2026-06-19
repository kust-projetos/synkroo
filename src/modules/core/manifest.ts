export const coreManifest = {
  id: 'core',
  name: 'Núcleo',
  alwaysOn: true, // Core nunca é desativável
  menu: [
    // Configurações — sempre visível para usuário autenticado (RBAC: core:view)
    {
      moduleId: 'core',
      permission: 'core:view',
      label: 'Configurações',
      path: '/dashboard/configuracoes',
      icon: 'Cog6ToothIcon',
    },
    {
      moduleId: 'core',
      permission: 'core:manage_users',
      label: 'Usuários e acessos',
      path: '/dashboard/configuracoes/acessos',
      icon: 'UsersIcon',
    },
  ],
  jobs: [] as string[],
};
