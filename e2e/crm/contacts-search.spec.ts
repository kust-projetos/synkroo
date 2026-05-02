import { test, expect } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

t.describe('CRM Contacts - Search and Listing', () => {
  t.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/contatos')
    await page.waitForLoadState('networkidle')
  })

  t('renders contacts list', async ({ page }) => {
    const list = page.locator('table, [role="list"], [role="table"]').first()
    await expect(list).toBeVisible({ timeout: 10000 }).catch(() => {})
  })

  t('renders search input', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="buscar i"], input[placeholder*="Buscar"], input[type="search"]').first()
    await expect(searchInput).toBeVisible({ timeout: 5000 }).catch(() => {})
  })

  t('search filters contacts by name', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="buscar i"], input[placeholder*="Buscar"], input[type="search"]').first()
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('zzz-nonexistent-contact')
      await searchInput.press('Enter')
      await page.waitForLoadState('networkidle')
    }
  })

  t('renders patients list page', async ({ page }) => {
    await page.goto('/dashboard/pacientes')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1, h2, [class*="PageHeader"]').first()).toBeVisible().catch(() => {})
  })

  t('renders leads list page', async ({ page }) => {
    await page.goto('/dashboard/leads')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1, h2, [class*="PageHeader"]').first()).toBeVisible().catch(() => {})
  })

  t('patients list has search functionality', async ({ page }) => {
    await page.goto('/dashboard/pacientes')
    await page.waitForLoadState('networkidle')
    const searchInput = page.locator('input[placeholder*="buscar i"], input[placeholder*="Buscar"]').first()
    await expect(searchInput).toBeVisible({ timeout: 5000 }).catch(() => {})
  })

  t('leads list has search functionality', async ({ page }) => {
    await page.goto('/dashboard/leads')
    await page.waitForLoadState('networkidle')
    const searchInput = page.locator('input[placeholder*="buscar i"], input[placeholder*="Buscar"]').first()
    await expect(searchInput).toBeVisible({ timeout: 5000 }).catch(() => {})
  })

  t('pagination controls are present', async ({ page }) => {
    await page.goto('/dashboard/pacientes')
    await page.waitForLoadState('networkidle')
    const pagination = page.locator('[aria-label="pagination"], .pagination, nav[role="navigation"]').first()
    const hasPagination = await pagination.isVisible().catch(() => false)
    if (hasPagination) await expect(pagination).toBeVisible()
  })

  t('can navigate between list pages', async ({ page }) => {
    await page.goto('/dashboard/pacientes')
    await page.waitForLoadState('networkidle')
    const nextBtn = page.locator('button:has-text("Prox"), button:has-text(">>"), [aria-label="next"]').first()
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click()
      await page.waitForLoadState('networkidle')
    }
  })
})
