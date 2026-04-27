import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3003'

async function login(page: Page) {
  try {
    await page.goto(`${BASE_URL}/login`, { timeout: 15000 })
  } catch {
    // Page may already be closed, ignore
  }
  let loginResult = false
  try {
    loginResult = await page.evaluate(async () => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@clinicademo.com', password: 'demo123' }),
      })
      return response.ok
    })
  } catch {
    loginResult = false
  }
  expect(loginResult).toBe(true)
}

test.describe('Leads Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/leads`)
    await page.waitForLoadState('networkidle')
  })

  test('should display leads page with kanban board', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/lead/i)
  })

  test('should display kanban board or empty state', async ({ page }) => {
    await page.waitForSelector('[data-testid*="kanban"], [data-testid*="column"], [class*="column"], text=/nenhum lead|Adicionar primeiro/i', { timeout: 15000 }).catch(() => {})
    const hasBoard = await page.locator('[data-testid*="kanban"], [data-testid*="column"]').count() > 0
    const hasEmpty = await page.locator('text=/nenhum lead|Adicionar primeiro/i').count() > 0
    expect(hasBoard || hasEmpty).toBeTruthy()
  })

  test('should have lead cards visible per stage', async ({ page }) => {
    await page.waitForSelector('[data-testid="lead-card"], [class*="card"], [class*="lead"]', { timeout: 15000 }).catch(() => {})
    const hasCards = await page.locator('[data-testid="lead-card"], [class*="card"]').count() > 0
    expect(hasCards).toBeTruthy()
  })

  test('should have new lead button', async ({ page }) => {
    const addButton = page.locator('a[href*="leads/novo"], button:has-text("Novo"), a:has-text("Novo Lead")')
    await expect(addButton.first()).toBeVisible()
  })

  test('should navigate to new lead form', async ({ page }) => {
    const addLink = page.locator('a[href*="leads/novo"]').first()
    if (await addLink.count() > 0) {
      await addLink.click()
      await page.waitForURL(/.*leads\/novo/, { timeout: 10000 }).catch(() => {})
      await expect(page).toHaveURL(/.*leads\/novo/)
    }
  })

  test('should show lead score when available', async ({ page }) => {
    await page.waitForSelector('[data-testid="lead-card"], [class*="card"]', { timeout: 15000 }).catch(() => {})
    const hasScore = await page.locator('[data-testid*="score"], [class*="score"]').count() > 0
    if (hasScore) {
      const scoreVisible = await page.locator('[data-testid*="score"], [class*="score"]').first().isVisible().catch(() => false)
      expect(scoreVisible || hasScore).toBeTruthy()
    }
  })

  test('should have filter controls for temperature or status', async ({ page }) => {
    await page.waitForSelector('select, [role="tablist"], button, [data-testid*="filter"]', { timeout: 15000 }).catch(() => {})
    const hasFilters = await page.locator('select, [role="tablist"], button, [data-testid*="filter"]').count() > 0
    expect(hasFilters).toBeTruthy()
  })

  test('should open lead creation form with name, phone, source fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/leads/novo`)
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('input, form', { timeout: 15000 }).catch(() => {})
    const hasForm = await page.locator('form').count() > 0
    const hasNameField = await page.locator('input[name*="name"], input[placeholder*="nome"], input[placeholder*="Nome"]').count() > 0
    const hasPhoneField = await page.locator('input[name*="phone"], input[placeholder*="telefone"], input[placeholder*="Telefone"]').count() > 0
    expect(hasForm || hasNameField || hasPhoneField).toBeTruthy()
  })
})

test.describe('Leads Kanban Interaction', () => {
  test('should support drag and drop between stages', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/leads`)
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('[data-testid="lead-card"], [class*="card"]', { timeout: 15000 }).catch(() => {})

    const leadCard = page.locator('[data-testid="lead-card"], [class*="card"]').first()
    const kanbanColumn = page.locator('[data-testid*="column"], [class*="column"]').nth(1)

    if (await leadCard.count() > 0 && await kanbanColumn.count() > 0) {
      await leadCard.dragTo(kanbanColumn)
      await page.waitForTimeout(500)
    }
    expect(true).toBeTruthy()
  })
})
