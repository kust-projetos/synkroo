/**
 * build-menu — Monta o menu de navegação a partir dos manifests de módulo.
 *
 * Reutiliza `filterMenuByAccess` (W3.3) para filtrar itens por:
 *  1. módulo ativo (contratado / always-on)
 *  2. permissão do usuário
 *
 * @see docs/superpowers/plans/2026-06-17-w6-frontend-base.md
 */
import { filterMenuByAccess, type MenuItem } from '@/core/modules/gates'

/**
 * Manifesto de um módulo com itens de menu.
 * shape compatível com `coreManifest` (W3.4/W6).
 */
export interface ModuleWithMenu {
  id: string
  menu: MenuItem[]
}

/**
 * Manifest de habilitação de módulos (retorna se cada módulo está ativo).
 */
export type ManifestLike = {
  isEnabled(id: string): Promise<boolean>
}

/**
 * Predicado de verificação de permissão (recebe a chave de permissão, retorna se o
 * usuário atual tem acesso).
 */
export type CanFn = (permission: string) => boolean

/**
 * Coleta todos os itens de `manifests`, filtra pelos módulos ativos e pela permissão
 * do usuário, e retorna a lista de itens a exibir no menu.
 *
 * @param manifests  — lista de módulos com `menu: MenuItem[]`
 * @param manifest  — instance manifest com `isEnabled()`
 * @param can       — função `(permission) => boolean` vinda do contexto de auth
 */
export async function buildMenu(
  manifests: ModuleWithMenu[],
  manifest: ManifestLike,
  can: CanFn,
): Promise<MenuItem[]> {
  const all = manifests.flatMap((m) => m.menu)
  return filterMenuByAccess(all, manifest, can)
}
