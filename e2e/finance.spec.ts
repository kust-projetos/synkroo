import { test, expect } from '@playwright/test'

test.describe('Financeiro smoke', () => {
  test('authenticated user can open financeiro dashboard', async ({ page }) => {
    await page.goto('/dashboard/financeiro')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/dashboard\/financeiro/)
    // heading (não getByText: 'Financeiro' casa também o link do sidebar →
    // strict violation dependendo da hidratação; flake comprovado por snapshot).
    await expect(page.getByRole('heading', { name: 'Financeiro' })).toBeVisible()
    await expect(page.getByText('Gestão de orçamentos, pagamentos e cobranças')).toBeVisible()

    await expect(page.getByRole('tab', { name: 'Orçamentos' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Parcelas / Pagamentos' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Cobranças' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Config' })).toBeVisible()

    await expect(page.getByText('Cobranças Vencidas', { exact: true })).toBeVisible()
    await expect(page.getByText('Total em Atraso', { exact: true })).toBeVisible()
    await expect(page.getByTestId('finance-kpis')).toBeVisible()
  })
})
