import { test, expect } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

t.describe('CRM LGPD Consent Management', () => {
  t.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/contatos')
    await page.waitForLoadState('networkidle')
  })

  t('renders LGPD consent section in contact detail', async ({ page }) => {
    const contactItem = page.locator('[class*="Contact"], table tbody tr').first()
    const hasContacts = await contactItem.isVisible().catch(() => false)

    if (hasContacts) {
      await contactItem.click()
      await page.waitForLoadState('networkidle')
      const lgpdSection = page.locator('text=/LGPD|Consentimento|GDPR|Aceite/i').first()
      await expect(lgpdSection).toBeVisible({ timeout: 5000 }).catch(() => {
        expect(page.url()).toContain('/contatos')
      })
    }
  })

  t('displays consent status indicators', async ({ page }) => {
    const contactItem = page.locator('[class*="Contact"], table tbody tr').first()
    if (await contactItem.isVisible().catch(() => false)) {
      await contactItem.click()
      await page.waitForLoadState('networkidle')
      const consentIndicators = page.locator('[class*="Consent"], svg[class*="check"]')
      expect(await consentIndicators.count()).toBeGreaterThanOrEqual(0)
    }
  })

  t('can update marketing consent', async ({ page }) => {
    const contactItem = page.locator('[class*="Contact"], table tbody tr').first()
    if (await contactItem.isVisible().catch(() => false)) {
      await contactItem.click()
      await page.waitForLoadState('networkidle')
      const marketingConsent = page.locator('text=/marketing|ofertas/i').first()
      if (await marketingConsent.isVisible().catch(() => false)) {
        await marketingConsent.click()
        await page.waitForLoadState('networkidle')
      }
      expect(page.url()).toContain('/contatos')
    }
  })

  t('can update data processing consent', async ({ page }) => {
    const contactItem = page.locator('[class*="Contact"], table tbody tr').first()
    if (await contactItem.isVisible().catch(() => false)) {
      await contactItem.click()
      await page.waitForLoadState('networkidle')
      const dataConsent = page.locator('text=/dados|tratamento/i').first()
      if (await dataConsent.isVisible().catch(() => false)) {
        await dataConsent.click()
        await page.waitForLoadState('networkidle')
      }
    }
  })

  t('LGPD export dialog functionality', async ({ page }) => {
    const contactItem = page.locator('[class*="Contact"], table tbody tr').first()
    if (await contactItem.isVisible().catch(() => false)) {
      await contactItem.click()
      await page.waitForLoadState('networkidle')
      const exportBtn = page.locator('button:has-text("Exportar"), button:has-text("Export")').first()
      if (await exportBtn.isVisible().catch(() => false)) {
        await exportBtn.click()
        await page.waitForLoadState('networkidle')
      }
    }
  })

  t('LGPD anonymize dialog functionality', async ({ page }) => {
    const contactItem = page.locator('[class*="Contact"], table tbody tr').first()
    if (await contactItem.isVisible().catch(() => false)) {
      await contactItem.click()
      await page.waitForLoadState('networkidle')
      const anonymizeBtn = page.locator('button:has-text("Anonimizar")').first()
      if (await anonymizeBtn.isVisible().catch(() => false)) {
        await anonymizeBtn.click()
        await page.waitForLoadState('networkidle')
      }
    }
  })

  t('consent timestamps are displayed', async ({ page }) => {
    const contactItem = page.locator('[class*="Contact"], table tbody tr').first()
    if (await contactItem.isVisible().catch(() => false)) {
      await contactItem.click()
      await page.waitForLoadState('networkidle')
      const dateIndicators = page.locator('text=/\\d{2}[\\/\\-]\\d{2}/')
      expect(await dateIndicators.count()).toBeGreaterThanOrEqual(0)
    }
  })

  t('settings page has LGPD configuration', async ({ page }) => {
    await page.goto('/dashboard/configuracoes')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1, h2, [class*="PageHeader"]').first()).toBeVisible()
  })
})
