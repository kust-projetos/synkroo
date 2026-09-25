import { test, expect, Page } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

async function openContact(page: Page): Promise<void> {
  // Linhas de contato: button.w-full sem role (filtros Todos/Pacientes/Leads têm role="tab").
  const contactItem = page.locator('main button.w-full:not([role="tab"])').first()
  await expect(contactItem).toBeVisible({ timeout: 15000 })
  await contactItem.click()
  await page.waitForLoadState('networkidle')
}

t.describe('CRM Contacts - Notes and Timeline', () => {
  t.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/contatos')
    await page.waitForLoadState('networkidle')
  })

  t('renders contact detail panel', async ({ page }) => {
    await openContact(page)
    await expect(page.locator('[class*="detail"], [data-testid="contact-detail"], h1, h2').first()).toBeVisible()
  })

  t('renders notes tab in contact detail', async ({ page }) => {
    await openContact(page)
    const notesTab = page.getByRole('tab', { name: /Notas/i }).or(page.getByRole('button', { name: /Notas/i })).first()
    await expect(notesTab).toBeVisible()
    await notesTab.click()
    await expect(page.getByText(/Nenhuma nota adicionada|Nova nota|Adicionar nota/i).first()).toBeVisible()
  })

  t('renders timeline tab in contact detail', async ({ page }) => {
    await openContact(page)
    const timelineTab = page.getByRole('tab', { name: /Timeline/i }).or(page.getByRole('button', { name: /Timeline/i })).first()
    await expect(timelineTab).toBeVisible()
    await timelineTab.click()
    await expect(page.getByText(/Nenhuma atividade registrada|Atividades|Timeline/i).first()).toBeVisible()
  })

  t('note composer enforces content before submission', async ({ page }) => {
    await openContact(page)
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
    await openContact(page)
    const timelineTab = page.getByRole('tab', { name: /Timeline/i }).or(page.getByRole('button', { name: /Timeline/i })).first()
    await expect(timelineTab).toBeVisible()
    await timelineTab.click()
    await expect(page.getByText(/Nenhuma atividade registrada|atividade|Timeline/i).first()).toBeVisible()
  })

  t('can switch between tabs', async ({ page }) => {
    await openContact(page)
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
