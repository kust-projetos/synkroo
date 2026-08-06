import { test, expect } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

t.describe('CRM Pipeline Page', () => {
  t.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/crm/pipeline')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
  })

  t('pipeline page loads without error', async ({ page }) => {
    await expect(page.locator('h1:has-text("Pipeline")')).toBeVisible({ timeout: 10000 })
  })

  t('kanban board renders stage columns', async ({ page }) => {
    await expect(page.locator('h3, [data-testid="pipeline-empty"]').first()).toBeVisible({ timeout: 15000 })
    expect(await page.locator('h3, [data-testid="pipeline-empty"]').count()).toBeGreaterThan(0)
  })

  t('lead cards or explicit empty state appear in kanban columns', async ({ page }) => {
    const cards = page.locator('[data-rfd-draggable-id], [draggable="true"]')
    const empty = page.locator('[data-testid="pipeline-empty"]')
    await expect(cards.first().or(empty.first())).toBeVisible({ timeout: 15000 })
  })

  t('stage columns show lead count or explicit empty state', async ({ page }) => {
    const stage = page.locator('h3').first()
    const empty = page.getByText('Nenhuma etapa de pipeline configurada.')
    await expect(stage.or(empty)).toBeVisible({ timeout: 15000 })
    if (await stage.count() > 0) await expect(stage).toContainText(/\d+/)
  })
})

t.describe('Pipeline API', () => {
  t('kanban page loads without a client error', async ({ page }) => {
    await page.goto('/dashboard/crm/pipeline')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1:has-text("Pipeline")')).toBeVisible()
    await expect(page.locator('nextjs-portal').or(page.getByText(/Application error|Unhandled Runtime Error/i))).toHaveCount(0)
  })
})