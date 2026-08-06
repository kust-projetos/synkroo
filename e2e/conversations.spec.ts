import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:3003'

test.use({ storageState: { cookies: [], origins: [] } })

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('#email', 'admin@clinicademo.com')
  await page.fill('#password', 'demo123')
  await Promise.all([
    page.waitForURL('**/dashboard**'),
    page.click('button[type="submit"]'),
  ])
}

async function openConversationOrAssertEmpty(page: Page): Promise<boolean> {
  const conversation = page.locator('[data-testid="conversation-item"], [class*="conversation"]').first()
  const emptyState = page.getByText('Selecione uma conversa').first()
  await expect(conversation.first().or(emptyState)).toBeVisible()
  if (await conversation.count() === 0) {
    await expect(emptyState).toBeVisible()
    return false
  }

  await expect(conversation).toBeVisible()
  await conversation.click()
  await page.waitForLoadState('networkidle')
  return true
}

test.describe('Conversations Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/conversas`)
    await page.waitForLoadState('networkidle')
  })

  test('should display conversations page', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/conversas/i)
  })

  test('should have conversation list or empty state', async ({ page }) => {
    const hasConversations = await page.locator('[data-testid="conversation-item"], [class*="conversation-item"]').count() > 0
    const hasEmptyState = await page.getByText('Selecione uma conversa').count() > 0
    expect(hasConversations || hasEmptyState).toBe(true)
  })

  test('should have filter buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Todas', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'WhatsApp', exact: true })).toBeVisible()
  })
})

test.describe('Conversation Thread', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/conversas`)
    await page.waitForLoadState('networkidle')
  })

  test('should open message thread when conversation clicked', async ({ page }) => {
    if (!await openConversationOrAssertEmpty(page)) return
    await expect(page.locator('[data-testid="message-thread"], [class*="message"], [class*="chat"]').first()).toBeVisible()
  })

  test('should display message bubbles in thread', async ({ page }) => {
    if (!await openConversationOrAssertEmpty(page)) return
    await expect(page.locator('[data-testid="message"], [class*="message"], [class*="bubble"]').first()).toBeVisible()
  })

  test('should have message input field', async ({ page }) => {
    if (!await openConversationOrAssertEmpty(page)) return
    await expect(page.locator('input[type="text"], textarea, [data-testid="message-input"]').first()).toBeVisible()
  })

  test('should send message', async ({ page }) => {
    if (!await openConversationOrAssertEmpty(page)) return
    const input = page.locator('input[type="text"], textarea, [data-testid="message-input"]').first()
    await expect(input).toBeVisible()
    await input.fill('Olá, teste de mensagem')
    const sendBtn = page.locator('button[type="submit"], button:has-text("Enviar"), [data-testid="send-button"]').first()
    await expect(sendBtn).toBeVisible()
    await sendBtn.click()
    await expect(page.locator('[data-testid="message"], [class*="message"]').last()).toContainText('Olá, teste de mensagem')
  })
})

test.describe('Campaign List', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/campanhas`)
    await page.waitForLoadState('networkidle')
  })

  test('should display campaign list or empty state', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/campanha/i)
    const hasList = await page.locator('table, [data-testid*="campaign"], [class*="campaign"]').count() > 0
    const hasEmpty = await page.getByText(/sem|nenhum|vazio/i).count() > 0
    expect(hasList || hasEmpty).toBe(true)
  })

  test('should show campaign status or empty state', async ({ page }) => {
    const hasStatus = await page.getByText(/ativa|pausada|concluíd/i).count() > 0
    const hasEmpty = await page.getByText(/sem|nenhum|vazio/i).count() > 0
    expect(hasStatus || hasEmpty).toBe(true)
  })
})
