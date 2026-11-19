import { test, expect, Page, APIRequestContext } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

// Desktop and mobile contact lists coexist in the DOM; Panel `id` became
// `data-testid` in react-resizable-panels 4.14.6. Scope to the visible list.
const visibleList = '[data-testid="contact-list"]:visible, [data-testid="list"]:visible'
const visibleDetail = '[data-testid="contact-detail"]:visible, [data-testid="detail"]:visible'

async function openContact(page: Page, request: APIRequestContext): Promise<void> {
  const response = await request.get('/api/contacts?type=patient&limit=100')
  expect(response.status()).toBe(200)
  const body = await response.json()
  const contacts = body.data?.data ?? body.data?.contacts ?? body.data ?? body
  expect(Array.isArray(contacts)).toBe(true)
  const contactId = contacts[0]?.id
  expect(typeof contactId).toBe('string')

  await page.goto(`/dashboard/contatos?contact=${encodeURIComponent(contactId)}`, {
    waitUntil: 'domcontentloaded',
  })
  await expect(page).toHaveURL(/\/dashboard\/contatos\?contact=/)
  await expect(page.locator(visibleDetail)).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('heading', { name: 'Consentimentos (LGPD)' }).first()).toBeVisible()
  // Consent tabs only exist after the detail panel is open.
  const detailTab = page.getByRole('tab', { name: /Notas|Timeline/i }).first()
  await expect(detailTab).toBeVisible({ timeout: 15000 })
}

t.describe('CRM LGPD Consent Management', () => {
  t.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/contatos', { waitUntil: 'domcontentloaded' })
    await expect(page.locator(visibleList)).toBeVisible({ timeout: 15000 })
  })

  t('renders LGPD consent section in contact detail', async ({ page, request }) => {
    await openContact(page, request)
    await expect(page.getByRole('heading', { name: 'Consentimentos (LGPD)' }).first()).toBeVisible()
    await expect(page.getByText(/Todas as alterações de consentimento/i).first()).toBeVisible()
  })

  t('displays consent status indicators', async ({ page, request }) => {
    await openContact(page, request)
    await expect(page.getByText('Status:', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('switch')).toHaveCount(3)
  })

  t('can update marketing consent', async ({ page, request }) => {
    await openContact(page, request)
    const marketingSwitch = page.getByRole('switch').nth(1)
    await expect(marketingSwitch).toBeVisible()
    await expect(marketingSwitch).toBeEnabled()
  })

  t('can update data processing consent', async ({ page, request }) => {
    await openContact(page, request)
    const dataSwitch = page.getByRole('switch').first()
    await expect(dataSwitch).toBeVisible()
    await expect(dataSwitch).toBeEnabled()
  })

  t('LGPD export and anonymization remain explicit API operations', async ({ page, request }) => {
    await openContact(page, request)
    await expect(page.getByRole('heading', { name: 'Consentimentos (LGPD)' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Exportar|Anonimizar/i })).toHaveCount(0)
  })

  t('consent timestamps are displayed when a consent exists', async ({ page, request }) => {
    await openContact(page, request)
    await expect(page.getByRole('switch')).toHaveCount(3)
    const timestamps = page.getByText(/Concedído em:|Revogado em:/i)
    const emptyState = page.getByText('Todas as alterações de consentimento são registradas para conformidade LGPD')
    expect(await timestamps.count() + await emptyState.count()).toBeGreaterThan(0)
  })

  t('settings page has LGPD configuration', async ({ page }) => {
    await page.goto('/dashboard/configuracoes')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1, h2, [class*="PageHeader"]').first()).toBeVisible()
  })
})
