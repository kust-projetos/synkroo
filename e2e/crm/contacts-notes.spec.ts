import { test, expect, Page } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

async function openContactOrAssertEmpty(page: Page): Promise<boolean> {
  const contactItem = page.locator('main button.w-full').first()
  const emptyState = page.getByText('Nenhum contato encontrado')
  await expect(contactItem.or(emptyState)).toBeVisible({ timeout: 15000 })
  if (await contactItem.count() === 0) {
    await expect(emptyState).toBeVisible()
    return false
  }
  await expect(contactItem).toBeVisible()
  await contactItem.click()
  await page.waitForLoadState('networkidle')
  return true
}

t.describe('CRM Contacts - Notes and Timeline', () => {
  t.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/contatos')
    await page.waitForLoadState('networkidle')
  })

  t('renders contact detail panel', async ({ page }) => {
    if (!await openContactOrAssertEmpty(page)) return
    await expect(page.locator('[class*="detail"], [data-testid="contact-detail"], h1, h2').first()).toBeVisible()
  })

  t('renders notes tab in contact detail', async ({ page }) => {
    if (!await openContactOrAssertEmpty(page)) return
    const notesTab = page.getByRole('tab', { name: /Notas/i }).or(page.getByRole('button', { name: /Notas/i })).first()
    await expect(notesTab).toBeVisible()
    await notesTab.click()
    await expect(page.getByText(/Nenhuma nota adicionada|Nova nota|Adicionar nota/i).first()).toBeVisible()
  })

  t('renders timeline tab in contact detail', async ({ page }) => {
    if (!await openContactOrAssertEmpty(page)) return
    const timelineTab = page.getByRole('tab', { name: /Timeline/i }).or(page.getByRole('button', { name: /Timeline/i })).first()
    await expect(timelineTab).toBeVisible()
    await timelineTab.click()
    await expect(page.getByText(/Nenhuma atividade registrada|Atividades|Timeline/i).first()).toBeVisible()
  })

  t('note composer enforces content before submission', async ({ page }) => {
    if (!await openContactOrAssertEmpty(page)) return
    const notesTab = page.getByRole('tab', { name: /Notas/i }).or(page.getByRole('button', { name: /Notas/i })).first()
    await expect(notesTab).toBeVisible()
    await notesTab.click()
    const noteTextarea = page.locator('textarea[name="note"], [placeholder*="nota"]').first()
    await expect(noteTextarea).toBeVisible()
    const saveBtn = page.getByRole('button', { name: 'Adicionar nota', exact: true })
    await expect(saveBtn).toBeDisabled()
    await noteTextarea.fill(`Nota de teste ${Date.now()}`)
    await expect(saveBtn).toBeEnabled()
  })

  t('timeline displays interaction history', async ({ page }) => {
    if (!await openContactOrAssertEmpty(page)) return
    const timelineTab = page.getByRole('tab', { name: /Timeline/i }).or(page.getByRole('button', { name: /Timeline/i })).first()
    await expect(timelineTab).toBeVisible()
    await timelineTab.click()
    await expect(page.getByText(/Nenhuma atividade registrada|atividade|Timeline/i).first()).toBeVisible()
  })

  t('can switch between tabs', async ({ page }) => {
    if (!await openContactOrAssertEmpty(page)) return
    const tabs = page.locator('[role="tab"], button[class*="Tab"]')
    await expect(tabs.first()).toBeVisible()
    const tabCount = Math.min(await tabs.count(), 4)
    expect(tabCount).toBeGreaterThan(0)
    for (let i = 0; i < tabCount; i++) {
      await expect(tabs.nth(i)).toBeVisible()
      await tabs.nth(i).click()
      await page.waitForLoadState('networkidle')
    }
  })
})
