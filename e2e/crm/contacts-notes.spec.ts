import { test, expect, Page } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

// Contrato de seletor: as branches desktop e mobile coexistem no DOM; o Panel
// desktop server-renderiza data-testid="list" no 4.14.3 e
// data-testid="contact-list" no 4.14.6. ":visible" resolve só a branch visível.
const visibleList = '[data-testid="contact-list"]:visible, [data-testid="list"]:visible'
const visibleDetail = '[data-testid="contact-detail"]:visible, [data-testid="detail"]:visible'

async function openContact(page: Page): Promise<void> {
  // Linhas de contato: button.w-full sem role (filtros Todos/Pacientes/Leads têm role="tab"),
  // escopadas à lista visível via chaining (a branch oculta coexiste no DOM).
  const contactItem = page.locator(visibleList).locator('button.w-full:not([role="tab"]):visible').first()
  await expect(contactItem).toBeVisible({ timeout: 15000 })
  // Clique único + 1 retry limitado: clique durante a hidratação é no-op
  // (handler ainda não anexado). Sem loop toPass; no máx. 2 cliques.
  await contactItem.click()
  try {
    await expect(page).toHaveURL(/contact=/, { timeout: 8000 })
  } catch {
    await contactItem.click()
    await expect(page).toHaveURL(/contact=/, { timeout: 15000 })
  }
  // Detalhe exclusivo: tabs Notas/Timeline so existem com painel aberto
  // (data-testid="contact-detail" existe nas duas branches; role query ignora a oculta).
  const detailTab = page.getByRole('tab', { name: /Notas|Timeline/i }).first()
  await expect(detailTab).toBeVisible({ timeout: 15000 })
}

t.describe('CRM Contacts - Notes and Timeline', () => {
  t.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/contatos', { waitUntil: 'domcontentloaded' })
    // Gate determinístico: lista visível renderizada (sem networkidle).
    // Desktop e mobile coexistem no DOM (testids "list"/"contact-list" por versão).
    await expect(page.locator(visibleList)).toBeVisible({ timeout: 15000 })
  })

  t('renders contact detail panel', async ({ page }) => {
    await openContact(page)
    // Assert only the detail container (h1/h2 genéricos dariam falso-positivo
    // sem o painel de detalhe; testids cobrem 4.14.3 "detail" e 4.14.6 "contact-detail").
    await expect(page.locator(visibleDetail)).toBeVisible()
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
    await expect(timelineTab).toBeVisible({ timeout: 10000 })
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
      const tab = tabs.nth(i)
      await expect(tab).toBeVisible()
      await tab.click()
      // Gate determinístico: Radix marca a tab ativa via data-state (sem networkidle).
      await expect(tab).toHaveAttribute('data-state', 'active')
    }
  })
})
