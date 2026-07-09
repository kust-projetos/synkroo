import { test, expect } from '@playwright/test';

test.describe('Financeiro smoke', () => {
  // Use empty storage to avoid any stale auth
  test.use({ storageState: { cookies: [], origins: [] } });

  test('authenticated user can open financeiro dashboard and see core tabs', async ({ page, context }) => {
    // Clear any existing cookies
    await context.clearCookies();

    // Login via API
    const loginRes = await page.request.post('/api/auth/login', {
      data: { email: 'admin@clinicademo.com', password: 'demo123' },
    });
    expect(loginRes.ok()).toBe(true);

    // Navigate to financeiro dashboard
    await page.goto('/dashboard/financeiro', { waitUntil: 'networkidle' });

    // Verify the page rendered with tab navigation
    await expect(page.getByRole('button', { name: 'Orçamentos' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Parcelas.*Pagamentos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cobranças' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Config' })).toBeVisible();
  });

  test('null ratios render as dash on dashboard', async ({ page, context }) => {
    await context.clearCookies();
    const loginRes = await page.request.post('/api/auth/login', {
      data: { email: 'admin@clinicademo.com', password: 'demo123' },
    });
    expect(loginRes.ok()).toBe(true);

    await page.goto('/dashboard/financeiro', { waitUntil: 'networkidle' });
    await expect(page.getByText('—').first()).toBeVisible({ timeout: 10000 });
  });

  test('dashboard metrics cards are displayed', async ({ page, context }) => {
    await context.clearCookies();
    const loginRes = await page.request.post('/api/auth/login', {
      data: { email: 'admin@clinicademo.com', password: 'demo123' },
    });
    expect(loginRes.ok()).toBe(true);

    await page.goto('/dashboard/financeiro', { waitUntil: 'networkidle' });
    await expect(page.getByText('Conversão de Orçamentos')).toBeVisible();
    await expect(page.getByText('Recuperação de Cobranças')).toBeVisible();
  });
});
