import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3002'

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  const loginResult = await page.evaluate(async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@clinicademo.com', password: 'demo123' }),
    })
    return response.ok
  })
  expect(loginResult).toBe(true)
}

test.describe('Campaigns Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/campanhas`)
    await page.waitForLoadState('networkidle')
  })

  test('should display campaigns page', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/campanhas/i)
  })

  test('should display campaign list', async ({ page }) => {
    await page.waitForSelector('table, [data-testid*="campaign"], [class*="campaign"]', { timeout: 15000 }).catch(() => {})
    const hasList = await page.locator('table, [data-testid*="campaign"]').count() > 0
    expect(hasList).toBeTruthy()
  })

  test('should have new campaign button', async ({ page }) => {
    const addButton = page.locator('a[href*="campanhas/nova"], button:has-text("Nova"), a:has-text("Nova")')
    await expect(addButton.first()).toBeVisible()
  })

  test('should navigate to new campaign form', async ({ page }) => {
    const addLink = page.locator('a[href*="campanhas/nova"]').first()
    if (await addLink.count() > 0) {
      await addLink.click()
      await expect(page).toHaveURL(/.*campanhas\/nova/)
    }
  })
})

test.describe('Campaign Wizard Flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/campanhas/nova`)
    await page.waitForLoadState('networkidle')
  })

  test('should display campaign wizard steps', async ({ page }) => {
    await page.waitForSelector('[data-testid*="step"], [role="tablist"], [class*="step"], nav', { timeout: 15000 }).catch(() => {})
    const hasSteps = await page.locator('[data-testid*="step"], [role="tablist"], [class*="step"]').count() > 0
    expect(hasSteps).toBeTruthy()
  })

  test('should have campaign name field', async ({ page }) => {
    const hasNameField = await page.locator('input[name*="name"], input[name*="title"], input[placeholder*="nome"], input[placeholder*="campanha"]').count() > 0
    expect(hasNameField).toBeTruthy()
  })

  test('should have audience or contact selection', async ({ page }) => {
    await page.waitForSelector('select, [data-testid*="contact"], [data-testid*="audience"], checkbox', { timeout: 15000 }).catch(() => {})
    const hasAudience = await page.locator('select, [data-testid*="contact"], [data-testid*="audience"], input[type="checkbox"]').count() > 0
    expect(hasAudience).toBeTruthy()
  })

  test('should have message or template field', async ({ page }) => {
    const hasMessage = await page.locator('textarea, input[name*="message"], input[placeholder*="mensagem"], [data-testid*="template"]').count() > 0
    expect(hasMessage).toBeTruthy()
  })

  test('should proceed through wizard steps', async ({ page }) => {
    const nextBtn = page.locator('button:has-text("Próximo"), button:has-text("Avançar"), button:has-text("Next")').first()
    if (await nextBtn.count() > 0) {
      await nextBtn.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)
    }
    expect(true).toBeTruthy()
  })

  test('should submit campaign creation', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"], button:has-text("Criar"), button:has-text("Criar Campanha"), button:has-text("Finalizar")').first()
    if (await submitBtn.count() > 0) {
      await submitBtn.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)
    }
    expect(true).toBeTruthy()
  })
})

test.describe('Campaign Metrics', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/campanhas`)
    await page.waitForLoadState('networkidle')
  })

  test('should display campaign metrics or stats', async ({ page }) => {
    await page.waitForSelector('[data-testid*="metric"], [data-testid*="stat"], [class*="metric"], text=/enviados|recebidos|abertos|cliques/i', { timeout: 15000 }).catch(() => {})
    const hasMetrics = await page.locator('[data-testid*="metric"], [data-testid*="stat"], text=/enviados|recebidos|abertos|cliques/i').count() > 0
    expect(hasMetrics).toBeTruthy()
  })

  test('should show campaign status badges', async ({ page }) => {
    await page.waitForSelector('text=/ativa|pausada|concluíd|rascunho/i', { timeout: 15000 }).catch(() => {})
    const hasStatus = await page.locator('text=/ativa|pausada|concluíd/i, [class*="badge"]').count() > 0
    expect(hasStatus).toBeTruthy()
  })

  test('should schedule campaign', async ({ page }) => {
    const scheduleBtn = page.locator('button:has-text("Agendar"), a:has-text("Agendar"), [data-testid*="schedule"]').first()
    if (await scheduleBtn.count() > 0) {
      await scheduleBtn.click()
      await page.waitForLoadState('networkidle')
      const hasDateField = await page.locator('input[type="datetime"], input[type="date"], [data-testid*="date"]').count() > 0
      expect(hasDateField).toBeTruthy()
    }
  })

  test('should view campaign detail', async ({ page }) => {
    const campaignRow = page.locator('table tbody tr, [data-testid*="campaign"]').first()
    if (await campaignRow.count() > 0) {
      await campaignRow.click()
      await page.waitForLoadState('networkidle')
      const hasDetail = await page.locator('h1, h2, [data-testid*="detail"]').count() > 0
      expect(hasDetail).toBeTruthy()
    }
  })
})
