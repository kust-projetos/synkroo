/**
 * W7.1: Catálogo e dependências de módulos — grafo aprovado.
 * core é always-on e implicitamente disponível, não aparece nos arrays.
 */
import { operacionalManifest } from '@/modules/operacional/manifest';
import { comercialManifest } from '@/modules/comercial/manifest';
import { atendimentoManifest } from '@/modules/atendimento/manifest';
import { crmManifest } from '@/modules/crm/manifest';
import { financeiroManifest } from '@/modules/financeiro/manifest';
import { followupManifest } from '@/modules/followup/manifest';
import { iaManifest } from '@/modules/ia/manifest';
import { coreManifest } from '@/modules/core/manifest';

export type Manifest = { id: string; dependsOn: readonly string[] };

const manifests: Manifest[] = [
  coreManifest,
  operacionalManifest,
  comercialManifest,
  atendimentoManifest,
  crmManifest,
  financeiroManifest,
  followupManifest,
  iaManifest,
];

export const moduleDependencies: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(manifests.map((manifest) => [manifest.id, manifest.dependsOn]));

export const approvedGraph: Record<string, string[]> = {
  core: [],
  operacional: [],
  comercial: ['operacional'],
  atendimento: ['operacional', 'comercial'],
  crm: ['operacional', 'comercial'],
  financeiro: ['operacional', 'comercial'],
  followup: ['operacional', 'atendimento', 'financeiro'],
  ia: ['atendimento', 'operacional'],
};

export function validateDefinitions(): { ok: true } | { ok: false; error: string } {
  const ids = new Set(manifests.map((m) => m.id));
  if (ids.size !== manifests.length) return { ok: false, error: 'duplicate manifest id' };
  for (const m of manifests) {
    const expected = approvedGraph[m.id];
    if (!expected) return { ok: false, error: `unknown manifest ${m.id}` };
    // core implicitamente disponível, não aparece nos arrays, mas validamos que dependsOn bate com aprovado (exceto core)
    const normalized = [...m.dependsOn].sort();
    const expectedSorted = [...expected].sort();
    if (JSON.stringify(normalized) !== JSON.stringify(expectedSorted)) {
      return { ok: false, error: `manifest ${m.id} dependsOn ${JSON.stringify(m.dependsOn)} != approved ${JSON.stringify(expected)}` };
    }
    for (const dep of m.dependsOn) {
      if (!ids.has(dep)) return { ok: false, error: `manifest ${m.id} depends on unknown ${dep}` };
    }
  }
  // checa ciclo via DFS com caminho completo para diagnóstico fail-closed
  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const graph = new Map<string, string[]>(manifests.map((m) => [m.id, [...m.dependsOn]] as [string, string[]]));
  let cyclePath: string | null = null;
  function dfs(id: string): boolean {
    if (onStack.has(id)) {
      const idx = stack.indexOf(id);
      const cycle = [...stack.slice(idx), id].join(' -> ');
      cyclePath = cycle;
      return true;
    }
    if (visited.has(id)) return false;
    visited.add(id);
    stack.push(id);
    onStack.add(id);
    for (const dep of graph.get(id) || []) if (dfs(dep)) return true;
    stack.pop();
    onStack.delete(id);
    return false;
  }
  for (const m of manifests) if (dfs(m.id)) return { ok: false, error: `cycle detected: ${cyclePath ?? m.id}` };
  return { ok: true };
}
