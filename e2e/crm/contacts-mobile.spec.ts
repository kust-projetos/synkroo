import { test, expect } from '@playwright/test'

test.describe('Contacts mobile layout', () => {
  test.use({ viewport: { width: 360, height: 800 } })

  test('uses list-to-detail navigation without horizontal overflow', async ({ page }) => {
    await page.goto('/dashboard/contatos')
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('contact-list')).toBeVisible({ timeout: 15_000 })
    await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)

    const contact = page.locator('[data-testid="contact-list"] button:not([role="tab"])').filter({ hasText: /Paciente|Lead/ }).first()
    await expect(contact).toBeVisible()
    // O clique pode disparar antes da hidratação do React (emulação mobile); repete até a URL mudar.
    await expect(async () => {
      await contact.click()
      await expect(page).toHaveURL(/contact=/)
    }).toPass({ timeout: 15_000 })

    await expect(page.getByTestId('contact-detail')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Voltar para contatos' })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Voltar para contatos' }).click()
    await expect(page.getByTestId('contact-list')).toBeVisible()
  })
})
