/**
 * build-menu tests.
 * @see src/lib/ui/build-menu.ts
 */
import { buildMenu } from '../build-menu'

// Helper: manifest-like que habilita módulos por lista.
function makeManifest(enabled: string[]) {
  return {
    isEnabled: async (id: string) => enabled.includes(id),
  }
}

describe('buildMenu', () => {
  it('retorna lista vazia quando nenhum módulo tem itens', async () => {
    const manifests: Parameters<typeof buildMenu>[0] = []
    const manifest = makeManifest(['core'])
    const can = () => true
    const result = await buildMenu(manifests, manifest, can)
    expect(result).toEqual([])
  })

  it('inclui item de módulo enabled + permissão granted', async () => {
    const manifests = [
      {
        id: 'core',
        menu: [{ moduleId: 'core', permission: 'core:manage_users', label: 'Usuários e acessos', path: '/dashboard/configuracoes/acessos' }],
      },
    ]
    const manifest = makeManifest(['core'])
    // Usuário com permissão
    const can = (p: string) => p === 'core:manage_users'
    const result = await buildMenu(manifests, manifest, can)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Usuários e acessos')
  })

  it('exclui item quando módulo está desabilitado', async () => {
    const manifests = [
      {
        id: 'financeiro',
        menu: [{ moduleId: 'financeiro', permission: 'financeiro:view', label: 'Financeiro', path: '/f' }],
      },
    ]
    // financeiro NÃO está habilitado
    const manifest = makeManifest(['core'])
    const can = () => true
    const result = await buildMenu(manifests, manifest, can)
    expect(result).toHaveLength(0)
  })

  it('exclui item quando usuário não tem permissão', async () => {
    const manifests = [
      {
        id: 'core',
        menu: [{ moduleId: 'core', permission: 'core:manage_users', label: 'Usuários e acessos', path: '/x' }],
      },
    ]
    const manifest = makeManifest(['core'])
    // Usuário SEM a permissão
    const can = () => false
    const result = await buildMenu(manifests, manifest, can)
    expect(result).toHaveLength(0)
  })

  it('múltiplos módulos: filtra corretamente por enabled + permission', async () => {
    const manifests = [
      {
        id: 'core',
        menu: [
          { moduleId: 'core', permission: 'core:manage_users', label: 'Usuários e acessos', path: '/x' },
          { moduleId: 'core', permission: 'core:admin', label: 'Admin', path: '/y' },
        ],
      },
      {
        id: 'financeiro',
        menu: [{ moduleId: 'financeiro', permission: 'financeiro:view', label: 'Financeiro', path: '/f' }],
      },
    ]
    // core enabled; financeiro NÃO
    // usuário só tem core:manage_users (não tem core:admin)
    const manifest = makeManifest(['core'])
    const can = (p: string) => p === 'core:manage_users'
    const result = await buildMenu(manifests, manifest, can)
    expect(result.map((i) => i.label)).toEqual(['Usuários e acessos'])
  })
})
