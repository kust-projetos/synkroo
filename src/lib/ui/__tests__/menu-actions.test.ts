/**
 * Tests for menu-actions Server Action.
 * @see src/lib/ui/menu-actions.ts
 */
import { getVisibleMenu, getVisibleCoreMenu } from '../menu-actions'
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
})

afterEach(() => {
  jest.clearAllMocks()
})

it('mostra ambos os itens do core para quem tem todas as permissões', async () => {
  ;(contextMod.buildUserContext as jest.Mock).mockResolvedValue(ctxWith(() => true))
  const menu = await getVisibleMenu()
  const labels = menu.map((m) => m.label)
  expect(labels).toContain('Configurações')
  expect(labels).toContain('Usuários e acessos')
})

it('oculta "Usuários e acessos" para quem não tem core:manage_users', async () => {
  ;(contextMod.buildUserContext as jest.Mock).mockResolvedValue(
    ctxWith((k) => k === 'core:view'),
  )
  const menu = await getVisibleMenu()
  const labels = menu.map((m) => m.label)
  expect(labels).toContain('Configurações')
  expect(labels).not.toContain('Usuários e acessos')
})

it('retorna [] quando o usuário não está autenticado', async () => {
  ;(contextMod.buildUserContext as jest.Mock).mockRejectedValue(
    new Error('unauthenticated'),
  )
  const menu = await getVisibleMenu()
  expect(menu).toEqual([])
})

it('mostra itens operacionais quando operacional:view presente', async () => {
  ;(contextMod.buildUserContext as jest.Mock).mockResolvedValue(
    ctxWith((k) => k.startsWith('operacional:') || k === 'core:view'),
  )
  const menu = await getVisibleMenu()
  const labels = menu.map((m) => m.label)
  expect(labels).toContain('Agendamentos')
  expect(labels).toContain('Pacientes')
  expect(labels).toContain('Lista de Espera')
  expect(labels).toContain('Dentistas')
  expect(labels).toContain('Procedimentos')
})

it('mostra Follow-up quando followup:view presente', async () => {
  ;(contextMod.buildUserContext as jest.Mock).mockResolvedValue(
    ctxWith((k) => k.startsWith('followup:') || k === 'core:view'),
  )
  const menu = await getVisibleMenu()
  const labels = menu.map((m) => m.label)
  expect(labels).toContain('Follow-up')
})

it('oculta Follow-up quando permissão ausente', async () => {
  ;(contextMod.buildUserContext as jest.Mock).mockResolvedValue(
    ctxWith((k) => k === 'core:view'), // sem nenhuma permissão followup:view
  )
  const menu = await getVisibleMenu()
  const labels = menu.map((m) => m.label)
  expect(labels).not.toContain('Follow-up')
})

it('mostra Conversas quando atendimento:view presente', async () => {
  ;(contextMod.buildUserContext as jest.Mock).mockResolvedValue(
    ctxWith((k) => k.startsWith('atendimento:') || k === 'core:view'),
  )
  const menu = await getVisibleMenu()
  const labels = menu.map((m) => m.label)
  expect(labels).toContain('Conversas')
})

it('oculta Conversas quando permissão ausente', async () => {
  ;(contextMod.buildUserContext as jest.Mock).mockResolvedValue(
    ctxWith((k) => k === 'core:view'), // sem nenhuma permissão atendimento:view
  )
  const menu = await getVisibleMenu()
  const labels = menu.map((m) => m.label)
  expect(labels).not.toContain('Conversas')
})

it('oculta itens operacionais quando permissão ausente', async () => {
  ;(contextMod.buildUserContext as jest.Mock).mockResolvedValue(
    ctxWith((k) => k === 'core:view'), // sem nenhuma permissão operacional
  )
  const menu = await getVisibleMenu()
  const labels = menu.map((m) => m.label)
  expect(labels).not.toContain('Agendamentos')
  expect(labels).not.toContain('Pacientes')
  expect(labels).not.toContain('Dentistas')
})

it('getVisibleCoreMenu é alias de getVisibleMenu', async () => {
  ;(contextMod.buildUserContext as jest.Mock).mockResolvedValue(ctxWith(() => true))
  const [menu1, menu2] = await Promise.all([getVisibleMenu(), getVisibleCoreMenu()])
  expect(menu1).toEqual(menu2)
})
