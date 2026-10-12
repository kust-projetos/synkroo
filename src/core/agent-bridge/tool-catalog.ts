import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ActionContext, ActionDefinition } from '@/core/actions/types';
import { getActions } from '@/core/actions/registry';
import { isAgentSafeAction } from './tool-policy';
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

// Metadata mínima necessária para descrever uma tool remota. Deliberadamente
// sem `handler`: o catálogo é serialização, nunca capacidade de execução.
type CatalogAction = Pick<
  ActionDefinition<any, any>,
  'name' | 'module' | 'requires' | 'label' | 'description' | 'input'
>;

export function toRemoteTool(action: CatalogAction): RemoteTool {
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

// Serializador interno — recebe lista JÁ autorizada e produz o ToolCatalog.
// Não decide autorização: chamador único é `buildToolCatalog` (abaixo).
// Versionado pelo conjunto ordenado de aliases (detecta drift).
function buildToolCatalogFromList(actions: CatalogAction[]): ToolCatalog {
  const tools = actions.map(toRemoteTool);
  const joined = [...tools.map((t) => t.alias)].sort().join('|');
  let h = 0;
  for (let i = 0; i < joined.length; i++) {
    h = (h * 31 + joined.charCodeAt(i)) | 0;
  }
  return { version: `v${(h >>> 0).toString(16)}`, tools };
}

/**
 * Catálogo de tools da bridge IA — seletor de METADATA, deny-by-default.
 *
 * Interseção (as três condições precisam ser verdadeiras):
 *   1. `isAgentSafeAction(a.name)` — allowlist literal da bridge IA (`tool-policy`);
 *   2. `ctx.hasModule(a.module)` — manifesto do módulo;
 *   3. `ctx.can(a.requires)` — permissão do principal.
 *
 * É o mesmo seletor usado por `listToolsLogic` (descoberta via handle), então
 * descoberta e catálogo público não podem divergir.
 *
 * O catálogo carrega apenas metadata (alias, descrição, JSON Schema, módulo,
 * permissão): nenhum callback executável é exposto. A execução continua
 * exclusiva de `executeActionLogic`, que revalida a allowlist antes de marcar
 * idempotência e antes do `runAction`.
 *
 * `actions` é opcional (default: registry global) para permitir injeção de
 * registry em testes e consumidores — o filtro é aplicado sobre a lista
 * recebida, nunca sobre a allowlist.
 */
export function buildToolCatalog(
  ctx: ActionContext,
  actions: CatalogAction[] = getActions(),
): ToolCatalog {
  return buildToolCatalogFromList(
    actions.filter(
      (a) =>
        isAgentSafeAction(a.name) &&
        ctx.hasModule(a.module) &&
        ctx.can(a.requires),
    ),
  );
}
