/**
 * Agente IA — module manifest.
 */
export const iaManifest = {
  id: 'ia' as const,
  name: 'Agente IA',
  dependsOn: ['atendimento', 'operacional'] as const,
  alwaysOn: false,
  menu: [],
  jobs: [] as string[],
};
