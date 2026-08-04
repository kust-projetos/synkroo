import { test, expect } from '@playwright/test'
import path from 'path'
import { SIDEBAR_LINKS } from '../helpers/navigation'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

t.describe('Sidebar Navigation', () => {
  t.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('aside')).toBeVisible()
  })
  for (const item of SIDEBAR_LINKS) {
    t(`navigates to ${item.name}`, async ({ page }) => {
      const link = page.locator(`aside a[href="${item.href}"]`)
      await expect(link).toBeVisible()
      await link.click()
      await page.waitForLoadState('networkidle')
      expect(page.url()).toContain(item.href)
    })
  }
})
