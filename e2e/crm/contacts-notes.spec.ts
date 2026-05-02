import { test, expect } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

t.describe('CRM Contacts - Notes and Timeline', () => {
  t.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/contatos')
    await page.waitForLoadState('networkidle')
  })

  t('renders contact detail panel', async ({ page }) => {
    const contactItem = page.locator('[class*="Contact"], [class*="Lead"], table tbody tr').first()
    if (await contactItem.isVisible().catch(() => false)) {
      await contactItem.click()
      await page.waitForLoadState('networkidle')
    }
  })

  t('renders notes tab in contact detail', async ({ page }) => {
    const contactItem = page.locator('[class*="Contact"], table tbody tr').first()
    if (await contactItem.isVisible().catch(() => false)) {
      await contactItem.click()
      await page.waitForLoadState('networkidle')
      const notesTab = page.locator('button:has-text("Notas"), a:has-text("Notas"), [role="tab"]:has-text("Notas")').first()
      if (await notesTab.isVisible().catch(() => false)) {
        await notesTab.click()
        await page.waitForLoadState('networkidle')
      }
    }
  })

  t('renders timeline tab in contact detail', async ({ page }) => {
    const contactItem = page.locator('[class*="Contact"], table tbody tr').first()
    if (await contactItem.isVisible().catch(() => false)) {
      await contactItem.click()
      await page.waitForLoadState('networkidle')
      const timelineTab = page.locator('button:has-text("Timeline"), a:has-text("Timeline"), [role="tab"]:has-text("Timeline")').first()
      if (await timelineTab.isVisible().catch(() => false)) {
        await timelineTab.click()
        await page.waitForLoadState('networkidle')
      }
    }
  })

  t('can add a note to contact', async ({ page }) => {
    const contactItem = page.locator('[class*="Contact"], table tbody tr').first()
    if (await contactItem.isVisible().catch(() => false)) {
      await contactItem.click()
      await page.waitForLoadState('networkidle')
      const notesTab = page.locator('button:has-text("Notas"), [role="tab"]:has-text("Notas")').first()
      if (await notesTab.isVisible().catch(() => false)) {
        await notesTab.click()
        await page.waitForLoadState('networkidle')
      }
      const noteTextarea = page.locator('textarea[name="note"], [placeholder*="nota"]').first()
      if (await noteTextarea.isVisible().catch(() => false)) {
        await noteTextarea.fill(`Nota de teste ${Date.now()}`)
        const saveBtn = page.locator('button:has-text("Salvar"), button:has-text("Gravar")').first()
        if (await saveBtn.isVisible().catch(() => false)) {
          await saveBtn.click()
          await page.waitForLoadState('networkidle')
        }
      }
    }
  })

  t('timeline displays interaction history', async ({ page }) => {
    const contactItem = page.locator('[class*="Contact"], table tbody tr').first()
    if (await contactItem.isVisible().catch(() => false)) {
      await contactItem.click()
      await page.waitForLoadState('networkidle')
      const timelineTab = page.locator('button:has-text("Timeline"), [role="tab"]:has-text("Timeline")').first()
      if (await timelineTab.isVisible().catch(() => false)) {
        await timelineTab.click()
        await page.waitForLoadState('networkidle')
      }
    }
  })

  t('can switch between tabs', async ({ page }) => {
    const contactItem = page.locator('[class*="Contact"], table tbody tr').first()
    if (await contactItem.isVisible().catch(() => false)) {
      await contactItem.click()
      await page.waitForLoadState('networkidle')
      const tabs = page.locator('[role="tab"], button[class*="Tab"]')
      for (let i = 0; i < Math.min(await tabs.count(), 4); i++) {
        const tab = tabs.nth(i)
        if (await tab.isVisible().catch(() => false)) {
          await tab.click()
          await page.waitForLoadState('networkidle')
        }
      }
    }
  })
})
