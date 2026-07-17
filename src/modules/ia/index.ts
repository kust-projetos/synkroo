/**
 * Agente IA — module public surface.
 * Sem actions próprias nesta fatia: as capacidades do agente são as Actions
 * dos outros módulos, expostas via tool-catalog. Exporta manifest + permissions.
 */
export const iaActions = [];

export { iaManifest } from './manifest';
export { iaAccessPermissions } from './permissions';
