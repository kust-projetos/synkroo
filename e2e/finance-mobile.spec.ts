import { test, expect } from '@playwright/test'

test.describe('Finance mobile layout', () => {
  test.use({ viewport: { width: 360, height: 800 } })

  test('reflows KPI cards and keeps tabs reachable', async ({ page }) => {
    await page.goto('/dashboard/financeiro')
    await page.waitForLoadState('networkidle')

    const kpis = page.getByTestId('finance-kpis')
    await expect(kpis).toBeVisible()
    await expect(kpis).toHaveClass(/grid-cols-1/)
    await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)

    const tablist = page.getByRole('tablist')
    await expect(tablist).toBeVisible()
    const collectionsTab = tablist.getByRole('tab', { name: 'Cobranças' })
    await expect(collectionsTab).toBeVisible()
    await collectionsTab.click()
    await expect(collectionsTab).toHaveAttribute('aria-selected', 'true')
  })
})
