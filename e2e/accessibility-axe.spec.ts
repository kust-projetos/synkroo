import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Varredura axe-core nas páginas públicas (Etapa 13 — a11y).
 *
 * Guarda transitória: `@axe-core/playwright` será instalada pelo planner
 * logo após esta etapa. O especificador NÃO-literal abaixo impede o `tsc`
 * de tentar resolver o módulo no typecheck (TS2307) enquanto a dep não
 * existe; sem a dep, os testes são pulados em vez de falhar.
 */
const AXE_MODULE_SPECIFIER = '@axe-core/playwright'

const IS_PRODUCTION = process.env.E2E_PRODUCTION === '1'

interface AxeViolation {
  id: string
  impact?: string
  description: string
}

interface AxeBuilderInstance {
  withTags(tags: string[]): {
    analyze(): Promise<{ violations: AxeViolation[] }>
  }
}

async function loadAxeBuilder(): Promise<null | (new (args: { page: Page }) => AxeBuilderInstance)> {
  try {
    const mod = (await import(AXE_MODULE_SPECIFIER)) as {
      default?: new (args: { page: Page }) => AxeBuilderInstance
    }
    return mod.default ?? null
  } catch {
    return null
  }
}

test.describe('Automated accessibility (axe)', () => {
  for (const path of ['/login', '/signup']) {
    test(`sem violacoes criticas/graves (wcag2a, wcag2aa) em ${path}`, async ({ page }) => {
      // /signup é 404 deliberado em produção (ADR-BASE-11); axe contra 404 não faz sentido.
      test.skip(IS_PRODUCTION && path === '/signup', 'ADR-BASE-11: /signup retorna 404 em produção')
      const AxeBuilder = await loadAxeBuilder()
      if (!AxeBuilder) {
        test.skip(true, '@axe-core/playwright ainda nao instalado — spec pulado ate a instalacao')
        return
      }

      await page.goto(path)
      await page.waitForLoadState('networkidle')

      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      const blocking = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      )
      expect(
        blocking,
        `violacoes axe bloqueantes em ${path}: ${JSON.stringify(blocking.map((v) => v.id))}`,
      ).toEqual([])
    })
  }
})
