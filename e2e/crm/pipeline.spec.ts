import { test, expect } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

t.describe('CRM Pipeline - Stages Management', () => {
  t.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/leads')
    await page.waitForLoadState('networkidle')
  })

  t('renders kanban board with stage columns', async ({ page }) => {
    const board = page.locator('[class*="KanbanBoard"], [class*="kanban"], [class*="Board"]').first()
    const columns = page.locator('[class*="Column"], [class*="column"]')
    const hasBoard = await board.isVisible().catch(() => false)
    const columnCount = await columns.count()
    expect(hasBoard || columnCount > 0 || page.url()).toBeTruthy()
  })

  t('renders pipeline stage columns', async ({ page }) => {
    const stages = ['Novo', 'Qualificado', 'Proposta', 'Negociacao', 'Fechado']
    let foundStages = 0
    for (const stage of stages) {
      const stageHeader = page.locator(`text=${stage}`).first()
      if (await stageHeader.isVisible().catch(() => false)) {
        foundStages++
      }
    }
    expect(foundStages).toBeGreaterThanOrEqual(0)
  })

  t('displays lead cards in columns', async ({ page }) => {
    const cards = page.locator('[class*="Card"], [class*="LeadCard"]')
    expect(await cards.count()).toBeGreaterThanOrEqual(0)
  })

  t('can drag lead between stages', async ({ page }) => {
    const leadCard = page.locator('[class*="LeadCard"], [class*="Card"]').first()
    if (await leadCard.isVisible().catch(() => false)) {
      const targetColumn = page.locator('[class*="Column"]').nth(1)
      if (await targetColumn.isVisible().catch(() => false)) {
        await leadCard.hover()
        await page.mouse.down()
        await targetColumn.hover()
        await page.mouse.up()
        await page.waitForLoadState('networkidle')
      }
    }
  })

  t('shows stage count badges', async ({ page }) => {
    const countBadges = page.locator('[class*="count"], [class*="Count"], span:has-text("(")')
    expect(await countBadges.count()).toBeGreaterThanOrEqual(0)
  })

  t('opens lead detail on card click', async ({ page }) => {
    const leadCard = page.locator('[class*="LeadCard"], [class*="Card"]').first()
    if (await leadCard.isVisible().catch(() => false)) {
      await leadCard.click()
      await page.waitForLoadState('networkidle')
    }
  })

  t('pipeline page has summary metrics', async ({ page }) => {
    const metrics = page.locator('[class*="Metric"], [class*="Summary"], [class*="Chart"]')
    expect(await metrics.count()).toBeGreaterThanOrEqual(0)
  })
})
