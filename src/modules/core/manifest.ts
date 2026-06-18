export const coreManifest = {
  id: 'core',
  name: 'Núcleo',
  alwaysOn: true,                 // Core nunca é desativável
  menu: [
    { moduleId: 'core', permission: 'core:manage_users', label: 'Usuários e acessos', path: '/dashboard/configuracoes/acessos' },
  ],
  jobs: [] as string[],
};
