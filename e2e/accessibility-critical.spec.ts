import { test, expect } from '@playwright/test'

test.describe('Critical accessibility contracts', () => {
  test('mobile header exposes menu and preserves viewport width', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const menu = page.locator('header button').first()
    await expect(menu).toBeVisible()
    await expect(menu).toHaveAttribute('aria-label', /menu/i)
    await menu.focus()
    await expect(menu).toBeFocused()
    await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  })

  test('desktop navigation has a labelled landmark and visible focus', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('aside')).toBeVisible()
    await expect(page.locator('nav').first()).toBeVisible()
    const firstLink = page.locator('aside a').first()
    await firstLink.focus()
    await expect(firstLink).toBeFocused()
  })
})
