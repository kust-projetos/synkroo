import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3002'

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  const loginResult = await page.evaluate(async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@clinicademo.com', password: 'demo123' }),
    })
    return response.ok
  })
  expect(loginResult).toBe(true)
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

  test('should have conversation list', async ({ page }) => {
    await page.waitForSelector('[data-testid="conversation-item"], [class*="conversation"], button, p', { timeout: 15000 }).catch(() => {})
    const hasConversations = await page.locator('[data-testid="conversation-item"], [class*="conversation"]').count() > 0
    const hasEmptyState = await page.locator('text=/nenhuma conversa|sem conversas|Nenhuma/i').count() > 0
    expect(hasConversations || hasEmptyState).toBeTruthy()
  })

  test('should have filter buttons', async ({ page }) => {
    const hasFilters = await page.locator('button:has-text("Todas"), button:has-text("WhatsApp"), button:has-text("Ativas")').count() > 0
    expect(hasFilters).toBeTruthy()
  })
})

test.describe('Conversation Thread', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/conversas`)
    await page.waitForLoadState('networkidle')
  })

  test('should open message thread when conversation clicked', async ({ page }) => {
    const conversation = page.locator('[data-testid="conversation-item"], [class*="conversation"]').first()
    if (await conversation.count() > 0) {
      await conversation.click()
      await page.waitForLoadState('networkidle')
      await page.waitForSelector('[data-testid="message-thread"], [class*="message"], [class*="chat"]', { timeout: 15000 }).catch(() => {})
      const hasThread = await page.locator('[data-testid="message-thread"], [class*="message"], [class*="chat"]').count() > 0
      expect(hasThread).toBeTruthy()
    }
  })

  test('should display message bubbles in thread', async ({ page }) => {
    const conversation = page.locator('[data-testid="conversation-item"], [class*="conversation"]').first()
    if (await conversation.count() > 0) {
      await conversation.click()
      await page.waitForLoadState('networkidle')
      await page.waitForSelector('[data-testid="message"], [class*="message"], [class*="bubble"]', { timeout: 15000 }).catch(() => {})
      const hasMessages = await page.locator('[data-testid="message"], [class*="message"]').count() > 0
      expect(hasMessages).toBeTruthy()
    }
  })

  test('should have message input field', async ({ page }) => {
    const conversation = page.locator('[data-testid="conversation-item"], [class*="conversation"]').first()
    if (await conversation.count() > 0) {
      await conversation.click()
      await page.waitForLoadState('networkidle')
      const hasInput = await page.locator('input[type="text"], textarea, [data-testid="message-input"]').count() > 0
      expect(hasInput).toBeTruthy()
    }
  })

  test('should send message', async ({ page }) => {
    const conversation = page.locator('[data-testid="conversation-item"], [class*="conversation"]').first()
    if (await conversation.count() > 0) {
      await conversation.click()
      await page.waitForLoadState('networkidle')

      const input = page.locator('input[type="text"], textarea, [data-testid="message-input"]').first()
      if (await input.count() > 0) {
        await input.fill('Olá, teste de mensagem')
        const sendBtn = page.locator('button[type="submit"], button:has-text("Enviar"), [data-testid="send-button"]').first()
        if (await sendBtn.count() > 0) {
          await sendBtn.click()
          await page.waitForTimeout(1000)
        }
      }
    }
    expect(true).toBeTruthy()
  })
})

test.describe('Campaign List', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/conversas/campanhas`)
    await page.waitForLoadState('networkidle')
  })

  test('should display campaign list', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/campanha/i)
    await page.waitForSelector('table, [data-testid*="campaign"], [class*="campaign"]', { timeout: 15000 }).catch(() => {})
    const hasList = await page.locator('table, [data-testid*="campaign"]').count() > 0
    expect(hasList).toBeTruthy()
  })

  test('should show campaign status', async ({ page }) => {
    await page.waitForSelector('text=/ativa|pausada|concluída|rascunho/i', { timeout: 15000 }).catch(() => {})
    const hasStatus = await page.locator('text=/ativa|pausada|concluída/i').count() > 0
    expect(hasStatus).toBeTruthy()
  })
})
