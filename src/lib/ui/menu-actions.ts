'use server'

import { buildUserContext } from '@/core/actions/context'
import { buildMenu } from '@/lib/ui/build-menu'
import { coreManifest } from '@/modules/core/manifest'
import { makeManifest, drizzleManifestRepo } from '@/core/modules/manifest'
import type { MenuItem } from '@/core/modules/gates'

/**
 * Retorna os itens de menu do módulo Core visíveis para o usuário atual,
 * já filtrados por RBAC (resolveAccess) + manifesto. Server-only: monta o
 * contexto no servidor. Em caso de não-autenticado/erro, retorna [] (o client
 * apenas não exibe os itens do core).
 */
export async function getVisibleCoreMenu(): Promise<MenuItem[]> {
  try {
    const ctx = await buildUserContext()
    return await buildMenu([coreManifest], makeManifest(drizzleManifestRepo), ctx.can)
  } catch {
    return []
  }
}
