/**
 * Tests for menu-actions Server Action.
 * @see src/lib/ui/menu-actions.ts
 */
import { getVisibleCoreMenu } from '../menu-actions'
import * as contextMod from '@/core/actions/context'
import * as manifestMod from '@/core/modules/manifest'
import type { ActionContext } from '@/core/actions/types'

jest.mock('@/core/actions/context')
jest.mock('@/core/modules/manifest')

function ctxWith(can: (k: string) => boolean): ActionContext {
  return {
    source: 'user',
    clinicId: 'c1',
    user: { id: 'u1', email: 'u@u', name: 'U' },
    can,
    hasModule: () => true,
    audit: { actor: 'u1' },
  }
}

beforeEach(() => {
  ;(manifestMod.makeManifest as jest.Mock).mockReturnValue({
    isEnabled: async () => true,
  })
  ;(manifestMod as unknown as { drizzleManifestRepo: unknown }).drizzleManifestRepo = {}
})

afterEach(() => {
  jest.clearAllMocks()
})

it('mostra ambos os itens do core para quem tem todas as permissões', async () => {
  ;(contextMod.buildUserContext as jest.Mock).mockResolvedValue(ctxWith(() => true))
  const menu = await getVisibleCoreMenu()
  const labels = menu.map((m) => m.label)
  expect(labels).toContain('Configurações')
  expect(labels).toContain('Usuários e acessos')
})

it('oculta "Usuários e acessos" para quem não tem core:manage_users', async () => {
  ;(contextMod.buildUserContext as jest.Mock).mockResolvedValue(
    ctxWith((k) => k === 'core:view'),
  )
  const menu = await getVisibleCoreMenu()
  const labels = menu.map((m) => m.label)
  expect(labels).toContain('Configurações')
  expect(labels).not.toContain('Usuários e acessos')
})

it('retorna [] quando o usuário não está autenticado', async () => {
  ;(contextMod.buildUserContext as jest.Mock).mockRejectedValue(
    new Error('unauthenticated'),
  )
  const menu = await getVisibleCoreMenu()
  expect(menu).toEqual([])
})
