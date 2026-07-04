'use server'

import { buildUserContext } from '@/core/actions/context'
import { buildMenu } from '@/lib/ui/build-menu'
import { coreManifest } from '@/modules/core/manifest'
import { operacionalManifest } from '@/modules/operacional/manifest'
import { atendimentoManifest } from '@/modules/atendimento/manifest'
import { followupManifest } from '@/modules/followup/manifest'
import { iaManifest } from '@/modules/ia/manifest'
import { comercialManifest } from '@/modules/comercial/manifest'
import { makeManifest, drizzleManifestRepo } from '@/core/modules/manifest'
import type { MenuItem } from '@/core/modules/gates'

/**
 * Retorna os itens de menu visíveis para o usuário atual,
 * já filtrados por módulo ativo + RBAC.
 * Server-only.
 */
export async function getVisibleMenu(): Promise<MenuItem[]> {
  try {
    const ctx = await buildUserContext()
    return await buildMenu([coreManifest, operacionalManifest, atendimentoManifest, followupManifest, iaManifest, comercialManifest], makeManifest(drizzleManifestRepo), ctx.can)
  } catch {
    return []
  }
}

/** Alias retrocompatível. */
export const getVisibleCoreMenu = getVisibleMenu
