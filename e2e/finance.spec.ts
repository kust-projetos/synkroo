import { test, expect } from '@playwright/test'

test.describe('Financeiro smoke', () => {
  test('authenticated user can open financeiro dashboard', async ({ page }) => {
    await page.goto('/dashboard/financeiro')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/dashboard\/financeiro/)
    await expect(page.getByText('Financeiro')).toBeVisible()
    await expect(page.getByText('Gestão de orçamentos, pagamentos e cobranças')).toBeVisible()

    await expect(page.getByRole('tab', { name: 'Orçamentos' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Parcelas / Pagamentos' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Cobranças' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Config' })).toBeVisible()

    await expect(page.getByText('Conversão de Orçamentos')).toBeVisible()
    await expect(page.getByText('Recuperação de Cobranças')).toBeVisible()

    const dashes = page.getByText('—')
    await expect(dashes.first()).toBeVisible()
    await expect(dashes).toHaveCount(2)
  })
})
