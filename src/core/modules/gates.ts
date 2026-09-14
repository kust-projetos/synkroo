import { apiErrors, generateRequestId } from '@/lib/api/response';
import { createManifest } from './manifest';

interface ManifestLike { isEnabled(id: string): Promise<boolean>; }

export class ModuleDisabledError extends Error {
  constructor(public moduleId: string) { super(`module disabled: ${moduleId}`); }
}

// Gate 1 — rotas/API: embrulha um route handler; 404 canônico quando o módulo está desativado.
// O gate roda ANTES do handler: módulo desabilitado + anônimo → 404 (não 401).
export function withModuleRoute(moduleId: string, manifest?: ManifestLike) {
  return function <H extends (...args: any[]) => Promise<Response>>(handler: H): H {
    return (async (...args: Parameters<H>) => {
      const m = manifest ?? createManifest();
      if (!(await m.isEnabled(moduleId))) {
        const requestId = generateRequestId();
        const res = apiErrors.notFound('Not found', requestId);
        res.headers.set('x-request-id', requestId);
        return res;
      }
      return handler(...args);
    }) as H;
  };
}

// Gate 2 — menu: mantém itens cujo módulo está ativo E o usuário tem a permissão.
export interface MenuItem { moduleId: string; permission: string; label: string; [k: string]: unknown; }
export async function filterMenuByAccess(
  items: MenuItem[], manifest: ManifestLike, can: (key: string) => boolean,
): Promise<MenuItem[]> {
  const out: MenuItem[] = [];
  for (const item of items) {
    if (can(item.permission) && (await manifest.isEnabled(item.moduleId))) out.push(item);
  }
  return out;
}

// Gate 4 — jobs em background: lança antes de agendar/executar um job de módulo desativado.
export async function assertModuleForJob(moduleId: string, manifest: ManifestLike): Promise<void> {
  if (!(await manifest.isEnabled(moduleId))) throw new ModuleDisabledError(moduleId);
}

// Gate 3 (tools do agente) já vive em `agentToolsFor` (W3.1), que filtra por ctx.hasModule.
