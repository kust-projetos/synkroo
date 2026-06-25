import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ActionContext, ActionDefinition } from '@/core/actions/types';
import { getActions } from '@/core/actions/registry';
import type { RemoteTool, ToolCatalog } from './types';

// Zen (e function-calling em geral) rejeita '.' no nome da tool → HTTP 400.
export function normalizeToolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '__');
}

// Extrai o objeto de schema "puro" (sem $ref/definitions de topo) para o LLM.
function flattenSchema(name: string, schema: any): Record<string, unknown> {
  if (schema?.definitions?.[name]) return schema.definitions[name];
  if (typeof schema?.$ref === 'string') {
    const refName = schema.$ref.split('/').pop();
    if (refName && schema?.definitions?.[refName]) return schema.definitions[refName];
  }
  const clone = { ...schema };
  delete (clone as any).$schema;
  delete (clone as any).definitions;
  delete (clone as any).$ref;
  return clone;
}

export function toRemoteTool(
  action: Pick<
    ActionDefinition<any, any>,
    'name' | 'module' | 'requires' | 'label' | 'description' | 'input'
  >,
): RemoteTool {
  const raw = zodToJsonSchema(action.input as never, action.name);
  return {
    name: action.name,
    alias: normalizeToolName(action.name),
    description: action.description ?? action.label,
    inputSchemaJson: flattenSchema(action.name, raw),
    module: action.module,
    permissions: [action.requires],
  };
}

// Catálogo a partir de uma lista de actions já filtrada — reutilizável e testável.
// Versionado pelo conjunto ordenado de aliases (detecta drift).
export function buildToolCatalogFromList(
  actions: Pick<
    ActionDefinition<any, any>,
    'name' | 'module' | 'requires' | 'label' | 'description' | 'input'
  >[],
): ToolCatalog {
  const tools = actions.map(toRemoteTool);
  const joined = [...tools.map((t) => t.alias)].sort().join('|');
  let h = 0;
  for (let i = 0; i < joined.length; i++) {
    h = (h * 31 + joined.charCodeAt(i)) | 0;
  }
  return { version: `v${(h >>> 0).toString(16)}`, tools };
}

// Catálogo filtrado pelo ctx (manifesto + permissão), sobre o registry global.
export function buildToolCatalog(ctx: ActionContext): ToolCatalog {
  return buildToolCatalogFromList(
    getActions().filter((a) => ctx.hasModule(a.module) && ctx.can(a.requires)),
  );
}
